import z from "zod";
import { TRPCError } from "@trpc/server";
import { agentProcedure, authenticatedProcedure, router } from "../../trpc";
import { generatePath } from "../../utils/path-generator";
import { chatService, CorsairAgent, ragService } from "../../services";
import { zodUndefinedModel } from "../../schema";
import { chatThreadModel, chatMessageModel } from "@repo/services/chat/model";
import { ragRunMetaModel } from "@repo/services/rag/model";

const TAGS = ["Agent"];
const getPath = generatePath("/agent");

function assertNotAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw new TRPCError({ code: "CLIENT_CLOSED_REQUEST", message: "Request aborted" });
  }
}

export const agentsRouter = router({
  runAgent: agentProcedure
    .input(z.object({ prompt: z.string().min(1), threadId: z.string().uuid().optional() }))
    .output(
      z.object({
        output: z.string(),
        threadId: z.string(),
        rag: ragRunMetaModel,
      }),
    )
    .mutation(async ({ ctx, input }) => {
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

      // RAG: ingest this message → retrieve top-k=3 → enhance prompt
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

      const history = await chatService.buildContext(ctx.user, thread.id);
      let output: string;
      try {
        output =
          (await new CorsairAgent(ctx.user).executePrompt(
            rag.enhancedPrompt,
            history,
            ctx.signal,
            { enhancedPrompt: rag.enhancedPrompt, retrieved: rag.retrieved },
          )) ?? "";
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          throw new TRPCError({ code: "CLIENT_CLOSED_REQUEST", message: "Request aborted" });
        }
        throw e;
      }

      assertNotAborted(ctx.signal);

      await chatService.appendMessage({
        userId: ctx.user,
        threadId: thread.id,
        role: "assistant",
        content: output,
      });

      return { output, threadId: thread.id, rag: rag.meta };
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
    .input(z.object({ threadId: z.string().uuid() }))
    .output(z.array(chatMessageModel))
    .query(async ({ ctx, input }) => {
      const messages = await chatService.getMessages(ctx.user, input.threadId);
      return messages.map((m) => ({
        id: m.id,
        threadId: m.threadId,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      }));
    }),
});
