import type { RouterInputs, RouterOutputs } from "@repo/trpc/client";
import { pickMutationState } from "~/lib/constants";
import { trpc } from "~/trpc/client";

/** Ask the course RAG assistant a question about indexed VTT/SRT content. */
export const courseAsk = () => pickMutationState(trpc.courseRag.ask.useMutation());

/** Rewrite a question three ways before retrieval (step-back, rewrite, sub-questions). */
export const courseRewritePrompt = () =>
  pickMutationState(trpc.courseRag.rewritePrompt.useMutation());

export type CourseAskInput = RouterInputs["courseRag"]["ask"];
export type CourseAskOutput = RouterOutputs["courseRag"]["ask"];
export type CourseRewritePromptInput = RouterInputs["courseRag"]["rewritePrompt"];
export type CourseRewritePromptOutput = RouterOutputs["courseRag"]["rewritePrompt"];
