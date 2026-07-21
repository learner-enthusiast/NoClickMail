import { env } from "../env";
import type { RetrievedChunkModelType } from "./model";

type ChatCompletionResponse = {
  choices?: { message?: { content?: string } }[];
};

/** Rewrites the user prompt using retrieved memory + original intent (gpt-4o-mini). */
export async function enhanceUserPrompt(
  userPrompt: string,
  retrieved: RetrievedChunkModelType[],
  signal?: AbortSignal,
): Promise<string> {
  if (retrieved.length === 0) return userPrompt;
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const memoryBlock = retrieved
    .map(
      (c, i) =>
        `[${i + 1}] (relevance ${c.score.toFixed(2)}, ${c.role} message)\n${c.text}`,
    )
    .join("\n\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    signal,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You enhance user prompts for an email and calendar AI assistant (Orion). " +
            "Use retrieved conversation memory when it helps disambiguate names, threads, or prior tasks. " +
            "Output ONLY the enhanced instruction — clear, actionable, under 120 words. No preamble.",
        },
        {
          role: "user",
          content: `Retrieved memory:\n${memoryBlock}\n\nOriginal user prompt:\n${userPrompt}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    // Fallback: template-based enhancement if LLM call fails
    return buildTemplateEnhancedPrompt(userPrompt, retrieved);
  }

  const json = (await res.json()) as ChatCompletionResponse;
  const enhanced = json.choices?.[0]?.message?.content?.trim();
  return enhanced && enhanced.length > 0
    ? enhanced
    : buildTemplateEnhancedPrompt(userPrompt, retrieved);
}

function buildTemplateEnhancedPrompt(
  userPrompt: string,
  retrieved: RetrievedChunkModelType[],
): string {
  const context = retrieved.map((c) => `- ${c.text}`).join("\n");
  return [
    "Use the following retrieved context from past conversations when relevant:",
    context,
    "",
    "User request:",
    userPrompt,
    "",
    "Respond to the user request using Corsair Gmail/Calendar tools as needed.",
  ].join("\n");
}
