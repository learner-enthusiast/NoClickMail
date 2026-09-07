import z from "zod";
import { TRPCError } from "@trpc/server";
import { agentProcedure, authenticatedProcedure, router } from "../../trpc";
import { chatService, ragService } from "../../services";
import { zodUndefinedModel } from "../../schema";
import { chatThreadModel, chatMessageModel } from "@repo/services/chat/model";
import { executeAgentTurn } from "./run-agent-stream";

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

      const thread = input.threadId
        ? await chatService.getThreadForUser(ctx.user, input.threadId)
        : await chatService.createThread(ctx.user, input.prompt.slice(0, 60));

      const userMsg = await chatService.appendMessage({
        userId: ctx.user,
        threadId: thread.id,
        role: "user",
        content: input.prompt,
      });

      assertNotAborted(ctx.signal);

      const rag = await ragService.runForUserMessage(
        {
          userId: ctx.user,
          threadId: thread.id,
          messageId: userMsg.id,
          prompt: input.prompt,
        },
        ctx.signal,
      );

      assertNotAborted(ctx.signal);

      yield {
        type: "meta" as const,
        threadId: thread.id,
        rag: rag.meta,
      };

      const { output, approvalId } = yield* executeAgentTurn({
        userId: ctx.user,
        prompt: input.prompt,
        threadId: thread.id,
        messageId: userMsg.id,
        rag,
        signal: ctx.signal,
      });

      assertNotAborted(ctx.signal);

      const assistantMsg = await chatService.appendMessage({
        userId: ctx.user,
        threadId: thread.id,
        role: "assistant",
        content: output,
        approvalId,
      });

      await ragService.storeChatTurn({
        userId: ctx.user,
        threadId: thread.id,
        messageId: userMsg.id,
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
