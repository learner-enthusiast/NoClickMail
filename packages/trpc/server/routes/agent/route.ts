import z from "zod";
import { authenticatedProcedure, router } from "../../trpc";
import { generatePath } from "../../utils/path-generator";
import { chatService, CorsairAgent } from "../../services";
import { zodUndefinedModel } from "../../schema";
import { chatThreadModel, chatMessageModel } from "@repo/services/chat/model";
const TAGS = ["Agent"];
const getPath = generatePath("/agent");

export const agentsRouter = router({
  runAgent: authenticatedProcedure
    .input(z.object({ prompt: z.string().min(1), threadId: z.string().uuid().optional() }))
    .output(z.object({ output: z.string(), threadId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // 1. ensure a thread (create on first message)
      const thread = input.threadId
        ? { id: input.threadId }
        : await chatService.createThread(ctx.user, input.prompt.slice(0, 60));
      // 2. persist the user turn
      await chatService.appendMessage({
        userId: ctx.user,
        threadId: thread.id,
        role: "user",
        content: input.prompt,
      });
      // 3. build CAREFUL context (bounded, tenant-scoped) — exclude the just-added msg if needed
      const history = await chatService.buildContext(ctx.user, thread.id);
      // 4. run the agent with history
      const output = (await new CorsairAgent(ctx.user).executePrompt(input.prompt, history)) ?? "";
      // 5. persist the assistant turn
      await chatService.appendMessage({
        userId: ctx.user,
        threadId: thread.id,
        role: "assistant",
        content: output,
      });
      return { output, threadId: thread.id };
    }),
  // plus queries
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
