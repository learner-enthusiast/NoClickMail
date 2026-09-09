import z from "zod";
import { TRPCError } from "@trpc/server";
import { agentProcedure, authenticatedProcedure, router } from "../../trpc";
import { chatService, ragService } from "../../services";
import { zodUndefinedModel } from "../../schema";
import { chatThreadModel, chatMessageModel } from "@repo/services/model";
import { streamAgentResponseForRagResult } from "./run-agent-stream";

function assertNotAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw new TRPCError({ code: "CLIENT_CLOSED_REQUEST", message: "Request aborted" });
  }
}

export const agentsRouter = router({
  runAgent: agentProcedure
    .input(z.object({ prompt: z.string().min(1), threadId: z.uuid().optional() }))
    .mutation(async function* ({ ctx, input }) {
      assertNotAborted(ctx.signal);

      // Step 1 — resolve thread (create on first message).
      const thread = input.threadId
        ? await chatService.getThreadForUser(ctx.user, input.threadId)
        : await chatService.createThread(ctx.user, input.prompt.slice(0, 60));

      // Step 2 — persist user message to Postgres (full transcript).
      const userMsg = await chatService.appendMessage({
        userId: ctx.user,
        threadId: thread.id,
        role: "user",
        content: input.prompt,
      });

      assertNotAborted(ctx.signal);

      // Step 3 — RAG: determiner + optional pgvector/Mem0 read (no writes yet).
      const rag = await ragService.classifyAndPrepareAgentContext(
        {
          userId: ctx.user,
          threadId: thread.id,
          messageId: userMsg.id,
          prompt: input.prompt,
        },
        ctx.signal,
      );

      assertNotAborted(ctx.signal);

      // Step 4 — stream routing metadata to the client.
      yield {
        type: "meta" as const,
        threadId: thread.id,
        rag: rag.meta,
      };

      // Step 5 — generate assistant output (Corsair / email writer / direct LLM).
      const { output, approvalId } = yield* streamAgentResponseForRagResult({
        userId: ctx.user,
        prompt: input.prompt,
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
        userContent: input.prompt,
        assistantContent: output,
      });

      // Step 8 — pgvector WRITE: chunk, embed, and store for RAG retrieval.
      await ragService.indexCompletedTurnForRetrieval({
        userId: ctx.user,
        threadId: thread.id,
        userMessageId: userMsg.id,
        assistantMessageId: assistantMsg.id,
        userContent: input.prompt,
        assistantContent: output,
      });

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
        createdAt: m.createdAt.toISOString(),
      }));
    }),
});
