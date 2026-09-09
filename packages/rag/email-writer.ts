import { completeChat } from "@repo/openai-client";
import type { LongTermMemoryModelType } from "@repo/rag-models/mem0.model";
import type { RetrievedChunkModelType } from "@repo/rag-models/retrieve.model";
import type { ThreadContextMessageModelType } from "@repo/rag-models/context.model";

const EMAIL_WRITER_MODEL = "gpt-4o-mini";

const EMAIL_WRITER_SYSTEM_PROMPT = `You are Orion's email writing specialist — an expert at professional, clear, human email.

Write or rewrite email content only. Follow the user's intent, tone, and audience.

Rules:
- Output the email body ready to send (and subject line on its own first line as "Subject: ..." when appropriate).
- Be concise, polite, and specific; avoid filler and AI clichés.
- Match formality to context (executive, client, internal team, etc.).
- When replying, reference the thread context naturally.
- Do not explain your process, add markdown fences, or mention that you are an AI.
- If critical details are missing, ask one short clarifying question instead of inventing facts.`;

export type GenerateEmailDraftInput = {
  prompt: string;
  enhancedPrompt?: string;
  history: ThreadContextMessageModelType[];
  retrieved: RetrievedChunkModelType[];
  longTermMemories: LongTermMemoryModelType[];
  signal?: AbortSignal;
};

function formatRetrievedContext(retrieved: RetrievedChunkModelType[]): string {
  if (retrieved.length === 0) return "";

  return retrieved
    .map(
      (chunk, index) =>
        `[context ${index + 1}] (${chunk.role}, relevance ${chunk.score.toFixed(2)})\n${chunk.text}`,
    )
    .join("\n\n");
}

function formatMemoryContext(memories: LongTermMemoryModelType[]): string {
  if (memories.length === 0) return "";

  return memories.map((memory, index) => `[memory ${index + 1}] ${memory.memory}`).join("\n");
}

/** Specialist agent for drafting and polishing email copy. */
export async function generateEmailDraft(input: GenerateEmailDraftInput): Promise<string> {
  const instruction = input.enhancedPrompt?.trim() || input.prompt;
  const retrievedBlock = formatRetrievedContext(input.retrieved);
  const memoryBlock = formatMemoryContext(input.longTermMemories);

  const userContent = [
    memoryBlock ? `Long-term memory:\n${memoryBlock}` : "",
    retrievedBlock ? `Retrieved conversation context:\n${retrievedBlock}` : "",
    `User request:\n${input.prompt}`,
    instruction !== input.prompt ? `\nExecution instruction:\n${instruction}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    return await completeChat({
      model: EMAIL_WRITER_MODEL,
      systemPrompt: EMAIL_WRITER_SYSTEM_PROMPT,
      messages: input.history.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      userPrompt: userContent,
      temperature: 0.4,
      signal: input.signal,
    });
  } catch {
    return "I couldn't draft the email. Please try again with a bit more detail about recipient, purpose, and tone.";
  }
}
