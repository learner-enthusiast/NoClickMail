import { completeChat } from "../open-ai_SDK";
import { formatCorsairToolsForPrompt } from "./corsair-tools";
import type { ThreadContextMessageModelType } from "./context.model";
import {
  requestDeterminationModel,
  type RequestDeterminationModelType,
} from "./determiner.model";

export { requestDeterminationModel, resolveRoute } from "./determiner.model";
export type { RequestDeterminationModelType, RagRoute } from "./determiner.model";

const DETERMINER_MODEL = "gpt-4o-mini";

const DETERMINER_SYSTEM_PROMPT = `You are Orion's request determiner — a routing model, not the user-facing assistant.

You receive:
- The last 10 thread messages (user and assistant)
- The latest user message
- The list of Corsair MCP tools and plugins available to the execution agent

Your job is to classify the latest user message and decide how the backend should handle it.

Decision rules (apply in order):
1. If the request is ambiguous (missing names, dates, which email/thread, etc.) set needsUserClarification=true and write one focused clarifyingQuestion. Set directResponse=null.
2. If the request is general chat, explanation, or answerable from the thread alone — no Gmail/Calendar actions, no Mem0 facts, no external retrieval — set requiresCorsairMcpTool=false, requiresLongTermMemory=false, requiresExternalEnhancement=false and write the full reply in directResponse.
3. If the request needs Gmail or Calendar actions (search mail, draft reply, create event, check schedule, etc.) set requiresCorsairMcpTool=true.
4. If the request references past preferences, standing instructions, or facts not visible in the last 10 messages set requiresLongTermMemory=true.
5. If retrieved conversation excerpts (Pinecone) or Mem0 memories should reshape the prompt before execution set requiresExternalEnhancement=true.

Corsair MCP capabilities:
${formatCorsairToolsForPrompt()}

Output valid JSON matching the schema only. Be conservative: prefer clarification over guessing.`;

function determinationJsonSchema() {
  return {
    type: "object",
    properties: {
      requiresCorsairMcpTool: { type: "boolean" },
      requiresLongTermMemory: { type: "boolean" },
      requiresExternalEnhancement: { type: "boolean" },
      needsUserClarification: { type: "boolean" },
      clarifyingQuestion: { type: ["string", "null"] },
      directResponse: { type: ["string", "null"] },
      reasoning: { type: "string" },
    },
    required: [
      "requiresCorsairMcpTool",
      "requiresLongTermMemory",
      "requiresExternalEnhancement",
      "needsUserClarification",
      "clarifyingQuestion",
      "directResponse",
      "reasoning",
    ],
    additionalProperties: false,
  };
}

function formatHistoryForDeterminer(history: ThreadContextMessageModelType[]): string {
  if (history.length === 0) return "(no prior messages)";
  return history.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
}

/** Run the determiner model on the last 10 messages + latest user prompt. */
export async function determineRequest(input: {
  history: ThreadContextMessageModelType[];
  prompt: string;
  signal?: AbortSignal;
}): Promise<RequestDeterminationModelType> {
  const recentHistory = input.history.slice(-10);

  return completeChat({
    model: DETERMINER_MODEL,
    systemPrompt: DETERMINER_SYSTEM_PROMPT,
    userPrompt: [
      "Recent thread (last 10 messages):",
      formatHistoryForDeterminer(recentHistory),
      "",
      `Latest user message:\n${input.prompt}`,
    ].join("\n"),
    temperature: 0,
    signal: input.signal,
    outputDto: {
      name: "request_determination",
      zodSchema: requestDeterminationModel,
      jsonSchema: determinationJsonSchema(),
    },
  });
}
