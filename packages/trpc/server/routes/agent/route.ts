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
  buildAgentPromptFromFile,
  decodeRunAgentFile,
  userMessageContentWithAttachment,
} from "./file-input";
import type { ExtractionMethodModelType, SupportedFileFormatModelType } from "@repo/services/model";
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

    let agentPrompt = trimmedPrompt || "Please analyze the attached document.";
    let userContent = trimmedPrompt;
    let fileMeta:
      | {
          filename: string;
          format: SupportedFileFormatModelType;
          method: ExtractionMethodModelType;
          lowConfidence: boolean;
        }
      | undefined;
    let extractedFileText: string | undefined;
    let attachedFilename: string | undefined;

    if (parsed.file) {
      const buffer = decodeRunAgentFile(parsed.file);
      const extraction = await fileExtractorService.extractText({
        file: buffer,
        filename: parsed.file.filename,
        mimeType: parsed.file.mimeType,
        ocrLanguage: "eng",
        minOcrConfidence: 60,
        pdfTextFallbackThreshold: 32,
      });

      agentPrompt = buildAgentPromptFromFile(trimmedPrompt, parsed.file.filename, extraction);
      userContent = userMessageContentWithAttachment(trimmedPrompt, parsed.file.filename);
      extractedFileText = extraction.text;
      attachedFilename = parsed.file.filename;
      fileMeta = {
        filename: parsed.file.filename,
        format: extraction.format,
        method: extraction.method,
        lowConfidence: extraction.lowConfidence,
      };
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

    if (parsed.file && isInngestEnabled()) {
      inngest.send({
        name: UPLOAD_IMAGE_AND_SAVE_EVENT,
        data: {
          userId: ctx.user,
          messageId: userMsg.id,
          filename: parsed.file.filename,
          mimeType: parsed.file.mimeType,
          data: parsed.file.data,
        },
      });
    }

    assertNotAborted(ctx.signal);

    if (parsed.file && isInngestEnabled()) {
      inngest.send({
        name: CHUNK_TEXT_AND_UPLOAD_EVENT,
        data: {
          userId: ctx.user,
          threadId: thread.id,
          messageId: userMsg.id,
          role: "user",
          ...(isProductionEnv() ? {} : { text: extractedFileText! }),
          sourceFilename: attachedFilename,
        },
      });
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
      file: fileMeta,
    };

    // Step 5 — generate assistant output (Corsair / email writer / direct LLM).
    const { output, approvalId } = yield* streamAgentResponseForRagResult({
      userId: ctx.user,
      prompt: agentPrompt,
      threadId: thread.id,
      messageId: userMsg.id,
      rag,
      signal: ctx.signal,
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
