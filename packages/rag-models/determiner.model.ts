import { z } from "zod";

/** Structured routing decision from the determiner model. */
export const requestDeterminationModel = z.object({
  requiresCorsairMcpTool: z
    .boolean()
    .describe("True when Gmail or Google Calendar actions via Corsair MCP are required."),
  requiresLongTermMemory: z
    .boolean()
    .describe("True when past preferences or standing instructions outside this thread would help."),
  requiresPgVectorRetrieval: z
    .boolean()
    .describe(
      "True when the answer may come from uploaded files/documents or earlier parts of this conversation not fully visible in the last 10 messages.",
    ),
  requiresExternalEnhancement: z
    .boolean()
    .describe("True when retrieved document excerpts or past context should reshape the prompt."),
  requiresEmailWriterAgent: z
    .boolean()
    .describe(
      "True when the user wants email copy drafted, rewritten, polished, or composed (subject/body/tone), including before a send/reply action.",
    ),
  requiresEditPendingApproval: z
    .boolean()
    .describe(
      "True when the user wants to change subject/body/recipient/signature on a pending approval already created in this thread, without sending yet.",
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
  if (
    !d.requiresCorsairMcpTool &&
    !d.requiresLongTermMemory &&
    !d.requiresPgVectorRetrieval &&
    !d.requiresExternalEnhancement &&
    !d.requiresEmailWriterAgent &&
    !d.requiresEditPendingApproval
  ) {
    return "direct";
  }
  return "agent";
}
