import { publicProcedure, router } from "../../trpc";
import { courseRagService } from "../../services";
import {
  courseAskInputModel,
  courseAskResultModel,
  rewritePromptInputModel,
  rewritePromptResultModel,
} from "@repo/services/course-rag/model";

export const courseRagRouter = router({
  /** Single entry point — ask a question against indexed course transcripts. */
  ask: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/course-rag/ask",
        tags: ["Course RAG"],
        summary: "Ask a question about Udemy course content (VTT/SRT RAG)",
      },
    })
    .input(courseAskInputModel)
    .output(courseAskResultModel)
    .mutation(async ({ input }) => {
      return courseRagService.ask(input);
    }),

  /** Rewrite a question: step-back, proper rewrite, and sub-questions. */
  rewritePrompt: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/course-rag/rewrite-prompt",
        tags: ["Course RAG"],
        summary: "Advanced prompt rewriting (step-back, rewrite, sub-questions)",
      },
    })
    .input(rewritePromptInputModel)
    .output(rewritePromptResultModel)
    .mutation(async ({ input }) => {
      return courseRagService.rewritePrompt(input);
    }),
});
