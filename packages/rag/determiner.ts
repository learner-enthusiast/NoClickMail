import { completeChat } from "@repo/openai-client";
import { formatCorsairToolsForPrompt } from "./corsair-tools";
import type { ThreadContextMessageModelType } from "@repo/rag-models/context.model";
import {
  requestDeterminationModel,
  type RequestDeterminationModelType,
} from "@repo/rag-models/determiner.model";

export { requestDeterminationModel, resolveRoute } from "@repo/rag-models/determiner.model";
export type { RequestDeterminationModelType, RagRoute } from "@repo/rag-models/determiner.model";

const DETERMINER_MODEL = "gpt-4o-mini";

const DETERMINER_SYSTEM_PROMPT = `You are Orion's request determiner — a routing model, not the user-facing assistant.

You receive:
- The last 10 thread messages (user and assistant)
- The latest user message
- The list of Corsair MCP tools and plugins available to the execution agent

Your job is to classify the latest user message and decide how the backend should handle it.

Decision rules (apply in order):
1. If the request is ambiguous about Gmail/Calendar actions only (missing recipient, date, which email/thread to act on) set needsUserClarification=true and write one focused clarifyingQuestion. Set directResponse=null. Do NOT clarify when the user asks about uploaded documents or facts that may be in a file they shared — set requiresPgVectorRetrieval=true instead (rule 8).
2. If the request is general chat, explanation, or answerable from the visible thread alone — no Gmail/Calendar actions, no recall of older preferences, no uploaded-document search, no email drafting — set requiresCorsairMcpTool=false, requiresLongTermMemory=false, requiresPgVectorRetrieval=false, requiresExternalEnhancement=false, requiresEmailWriterAgent=false and write the full reply in directResponse.
3. If the request needs Gmail or Calendar actions (search mail, send/reply, create event, check schedule, etc.) set requiresCorsairMcpTool=true.
4. If the user wants email copy drafted, composed, rewritten, polished, or a professional reply written (even if they may send it afterward) set requiresEmailWriterAgent=true. Examples: "draft an email", "rewrite this reply", "make it more professional", "compose a follow-up". Do NOT set this for read-only inbox tasks like search, list, or summarize unless they also ask for new email text.
5. requiresEmailWriterAgent can be true together with requiresCorsairMcpTool when the user wants Orion to write the email and then send/reply via Gmail.
6. If the request references past preferences, standing instructions, or things the user told you before that are not in the last 10 messages set requiresLongTermMemory=true.
7. If the user asks about uploaded files/documents, resumes, work history, employers, dates, or facts from something they attached — or the answer may be in earlier messages not fully shown — set requiresPgVectorRetrieval=true.
8. If you are unsure whether the answer is in an uploaded document or earlier conversation context, set requiresPgVectorRetrieval=true and needsUserClarification=false. Search first; never ask the user where information is stored.
9. If retrieved document excerpts or past context should reshape the prompt before execution set requiresExternalEnhancement=true (usually when requiresPgVectorRetrieval or requiresLongTermMemory is true).

Corsair MCP capabilities:
${formatCorsairToolsForPrompt()}

Output valid JSON matching the schema only. For document-related questions, prefer requiresPgVectorRetrieval over needsUserClarification.`;

function determinationJsonSchema() {
  return {
    type: "object",
    properties: {
      requiresCorsairMcpTool: { type: "boolean" },
      requiresLongTermMemory: { type: "boolean" },
      requiresPgVectorRetrieval: { type: "boolean" },
      requiresExternalEnhancement: { type: "boolean" },
      requiresEmailWriterAgent: { type: "boolean" },
      needsUserClarification: { type: "boolean" },
      clarifyingQuestion: { type: ["string", "null"] },
      directResponse: { type: ["string", "null"] },
      reasoning: { type: "string" },
    },
    required: [
      "requiresCorsairMcpTool",
      "requiresLongTermMemory",
      "requiresPgVectorRetrieval",
      "requiresExternalEnhancement",
      "requiresEmailWriterAgent",
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
