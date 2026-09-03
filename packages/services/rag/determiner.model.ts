import { z } from "zod";

/** Structured routing decision from the determiner model. */
export const requestDeterminationModel = z.object({
  requiresCorsairMcpTool: z
    .boolean()
    .describe("True when Gmail or Google Calendar actions via Corsair MCP are required."),
  requiresLongTermMemory: z
    .boolean()
    .describe("True when distilled user facts from Mem0 would help answer the request."),
  requiresExternalEnhancement: z
    .boolean()
    .describe(
      "True when the prompt should be enhanced using retrieved Pinecone excerpts and/or Mem0 memories.",
    ),
  needsUserClarification: z
    .boolean()
    .describe("True when the request is ambiguous and a clarifying question must be asked first."),
  clarifyingQuestion: z
    .string()
    .nullable()
    .describe("Question for the user when needsUserClarification is true; otherwise null."),
  directResponse: z
    .string()
    .nullable()
    .describe(
      "Assistant reply when no Corsair tools, long-term memory, or external enhancement is needed; otherwise null.",
    ),
  reasoning: z.string().describe("Brief internal rationale for the routing decision."),
});

export type RequestDeterminationModelType = z.infer<typeof requestDeterminationModel>;

export type RagRoute = "clarify" | "direct" | "agent";

export function resolveRoute(d: RequestDeterminationModelType): RagRoute {
  if (d.needsUserClarification && d.clarifyingQuestion?.trim()) return "clarify";
  if (!d.requiresCorsairMcpTool && !d.requiresLongTermMemory && !d.requiresExternalEnhancement) {
    return "direct";
  }
  return "agent";
}
