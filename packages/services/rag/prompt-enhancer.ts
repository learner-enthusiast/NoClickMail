import { completeChat } from "../open-ai_SDK";
import type { LongTermMemoryModelType } from "./mem0/model";
import type { RetrievedChunkModelType } from "./retrieve.model";

const ENHANCER_MODEL = "gpt-4o-mini";

const ENHANCER_SYSTEM_PROMPT =
  "You enhance user prompts for an email and calendar AI assistant (Orion). " +
  "Use retrieved conversation excerpts and long-term user memory when they help " +
  "disambiguate names, threads, preferences, or prior tasks. " +
  "Output ONLY the enhanced instruction — clear, actionable, under 120 words. No preamble.";

/**
 * Stage 3 — Enhance.
 *
 * Rewrites the user's prompt using Pinecone chunks and Mem0 long-term memories.
 * Falls back to template assembly if the LLM call fails.
 */
export async function enhanceUserPrompt(
  userPrompt: string,
  retrieved: RetrievedChunkModelType[],
  longTermMemories: LongTermMemoryModelType[],
  signal?: AbortSignal,
): Promise<string> {
  if (retrieved.length === 0 && longTermMemories.length === 0) return userPrompt;
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const chunkBlock =
    retrieved.length > 0
      ? retrieved
          .map(
            (c, i) =>
              `[chunk ${i + 1}] (relevance ${c.score.toFixed(2)}, ${c.role} message)\n${c.text}`,
          )
          .join("\n\n")
      : "";

  const mem0Block =
    longTermMemories.length > 0
      ? longTermMemories
          .map(
            (m, i) =>
              `[memory ${i + 1}] (relevance ${m.score.toFixed(2)})\n${m.memory}`,
          )
          .join("\n\n")
      : "";

  const contextSections = [
    chunkBlock ? `Recent conversation excerpts:\n${chunkBlock}` : "",
    mem0Block ? `Long-term user memory:\n${mem0Block}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    return await completeChat({
      model: ENHANCER_MODEL,
      systemPrompt: ENHANCER_SYSTEM_PROMPT,
      userPrompt: `${contextSections}\n\nOriginal user prompt:\n${userPrompt}`,
      temperature: 0.2,
      signal,
    });
  } catch {
    return buildTemplateEnhancedPrompt(userPrompt, retrieved, longTermMemories);
  }
}

function buildTemplateEnhancedPrompt(
  userPrompt: string,
  retrieved: RetrievedChunkModelType[],
  longTermMemories: LongTermMemoryModelType[],
): string {
  const sections: string[] = [];

  if (longTermMemories.length > 0) {
    sections.push(
      "Long-term user memory:",
      ...longTermMemories.map((m) => `- ${m.memory}`),
      "",
    );
  }

  if (retrieved.length > 0) {
    sections.push(
      "Retrieved context from past conversations:",
      ...retrieved.map((c) => `- ${c.text}`),
      "",
    );
  }

  sections.push(
    "User request:",
    userPrompt,
    "",
    "Respond to the user request using Corsair Gmail/Calendar tools as needed.",
  );

  return sections.join("\n");
}
