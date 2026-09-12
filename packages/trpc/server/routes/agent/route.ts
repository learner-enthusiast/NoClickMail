import z from "zod";
import { TRPCError } from "@trpc/server";
import { agentProcedure, authenticatedProcedure, router } from "../../trpc";
import { chatService, fileExtractorService, ragService } from "../../services";
import {
  CHUNK_TEXT_AND_UPLOAD_EVENT,
  UPLOAD_IMAGE_AND_SAVE_EVENT,
  inngest,
  isInngestEnabled,
} from "@repo/inngest";
import { zodUndefinedModel } from "../../schema";
import { chatThreadModel, chatMessageModel } from "@repo/services/model";
import { streamAgentResponseForRagResult } from "./run-agent-stream";
import {
  buildAgentPromptFromFiles,
  decodeRunAgentFiles,
  userMessageContentWithAttachments,
  type AttachmentMeta,
  type ExtractedAttachment,
} from "./file-input";
import { runAgentInputModel } from "./model";

function isProductionEnv(): boolean {
  return ["production", "prod"].includes(process.env.NODE_ENV ?? "");
}

function assertNotAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw new TRPCError({ code: "CLIENT_CLOSED_REQUEST", message: "Request aborted" });
  }
}

export const agentsRouter = router({
  runAgent: agentProcedure.input(runAgentInputModel).mutation(async function* ({ ctx, input }) {
    assertNotAborted(ctx.signal);

    const parsed = runAgentInputModel.parse(input);
    const trimmedPrompt = parsed.prompt.trim();

    const attachedFiles = parsed.files ?? [];

    let agentPrompt = trimmedPrompt;
    let userContent = trimmedPrompt;
    let filesMeta: AttachmentMeta[] | undefined;
    const attachments: ExtractedAttachment[] = [];

    if (attachedFiles.length > 0) {
      const buffers = decodeRunAgentFiles(attachedFiles);

      // Extract per file — the extractor detects each file's format independently,
      // so a single message can mix pdf, images, Word docs and spreadsheets.
      for (const [index, file] of attachedFiles.entries()) {
        const extraction = await fileExtractorService.extractText({
          file: buffers[index]!,
          filename: file.filename,
          mimeType: file.mimeType,
          ocrLanguage: "eng",
          minOcrConfidence: 60,
          pdfTextFallbackThreshold: 32,
        });

        attachments.push({ filename: file.filename, mimeType: file.mimeType, extraction });
        assertNotAborted(ctx.signal);
      }

      agentPrompt = buildAgentPromptFromFiles(trimmedPrompt, attachments);
      userContent = userMessageContentWithAttachments(
        trimmedPrompt,
        attachments.map((attachment) => attachment.filename),
      );
      filesMeta = attachments.map((attachment) => ({
        filename: attachment.filename,
        format: attachment.extraction.format,
        method: attachment.extraction.method,
        lowConfidence: attachment.extraction.lowConfidence,
      }));
    }

    // Step 1 — resolve thread (create on first message).
    const thread = parsed.threadId
      ? await chatService.getThreadForUser(ctx.user, parsed.threadId)
      : await chatService.createThread(ctx.user, userContent.slice(0, 60));

    // Step 2 — persist user message to Postgres (full transcript).
    const userMsg = await chatService.appendMessage({
      userId: ctx.user,
      threadId: thread.id,
      role: "user",
      content: userContent,
    });

    // Each attachment gets its own storage upload and its own indexing event, keyed by
    // attachmentIndex so parallel files never overwrite each other's object or vectors.
    if (attachedFiles.length > 0 && isInngestEnabled()) {
      inngest.send(
        attachedFiles.map((file, attachmentIndex) => ({
          name: UPLOAD_IMAGE_AND_SAVE_EVENT,
          data: {
            userId: ctx.user,
            messageId: userMsg.id,
            filename: file.filename,
            mimeType: file.mimeType,
            data: file.data,
            attachmentIndex,
          },
        })),
      );
    }

    assertNotAborted(ctx.signal);

    // Files that yielded no text (e.g. an image with nothing OCR-able) have nothing to index.
    const indexableAttachments = attachments
      .map((attachment, attachmentIndex) => ({ attachment, attachmentIndex }))
      .filter(({ attachment }) => attachment.extraction.text.trim().length > 0);

    if (indexableAttachments.length > 0 && isInngestEnabled()) {
      inngest.send(
        indexableAttachments.map(({ attachment, attachmentIndex }) => ({
          name: CHUNK_TEXT_AND_UPLOAD_EVENT,
          data: {
            userId: ctx.user,
            threadId: thread.id,
            messageId: userMsg.id,
            role: "user" as const,
            ...(isProductionEnv() ? {} : { text: attachment.extraction.text }),
            sourceFilename: attachment.filename,
            attachmentIndex,
          },
        })),
      );
    }

    // Step 3 — RAG: determiner + optional pgvector/Mem0 read (no writes yet).
    const rag = await ragService.classifyAndPrepareAgentContext(
      {
        userId: ctx.user,
        threadId: thread.id,
        messageId: userMsg.id,
        prompt: agentPrompt,
      },
      ctx.signal,
    );

    assertNotAborted(ctx.signal);

    // Step 4 — stream routing metadata to the client.
    yield {
      type: "meta" as const,
      threadId: thread.id,
      rag: rag.meta,
      files: filesMeta,
    };

    // Step 5 — generate assistant output (Corsair / email writer / direct LLM).
    const { output, approvalId } = yield* streamAgentResponseForRagResult({
      userId: ctx.user,
      prompt: agentPrompt,
      threadId: thread.id,
      messageId: userMsg.id,
      rag,
      signal: ctx.signal,
      attachedFiles: attachedFiles.map((file) => ({
        filename: file.filename,
        mimeType: file.mimeType,
        data: file.data,
      })),
    });

    assertNotAborted(ctx.signal);

    // Step 6 — persist assistant reply to Postgres.
    const assistantMsg = await chatService.appendMessage({
      userId: ctx.user,
      threadId: thread.id,
      role: "assistant",
      content: output,
      approvalId,
    });

    // Step 7 — Mem0 WRITE: queue fact extraction from this completed turn.
    await ragService.saveTurnToLongTermMemoryIfEnabled({
      userId: ctx.user,
      threadId: thread.id,
      messageId: userMsg.id,
      userContent,
      assistantContent: output,
    });

    // // Step 8 — pgvector WRITE: chunk, embed, and store for RAG retrieval.

    yield {
      type: "done" as const,
      threadId: thread.id,
      messageId: assistantMsg.id,
      output,
      rag: rag.meta,
      approvalId,
    };
  }),
  listThreads: authenticatedProcedure
    .input(zodUndefinedModel)
    .output(z.array(chatThreadModel))
    .query(async ({ ctx }) => {
      const threads = await chatService.listThreads(ctx.user);
      return threads.map((t) => ({
        id: t.id,
        title: t.title,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      }));
    }),
  threadMessages: authenticatedProcedure
    .input(z.object({ threadId: z.uuid() }))
    .output(z.array(chatMessageModel))
    .query(async ({ ctx, input }) => {
      const messages = await chatService.getMessages(ctx.user, input.threadId);
      return messages.map((m) => ({
        id: m.id,
        threadId: m.threadId,
        role: m.role,
        content: m.content,
        approvalId: m.approvalId,
        imageUrl: m.imageUrl,
        createdAt: m.createdAt.toISOString(),
      }));
    }),
});
