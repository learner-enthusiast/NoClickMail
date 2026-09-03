import { completeChat } from "../open-ai_SDK";
import type { LongTermMemoryModelType } from "./mem0/model";
import type { ThreadContextMessageModelType } from "./context.model";

const DIRECT_REPLY_MODEL = "gpt-4o-mini";

const DIRECT_REPLY_SYSTEM_PROMPT =
  "You are Orion, a concise executive assistant. Answer using thread context and long-term memory when provided. No Gmail/Calendar tools in this turn.";

/**
 * Non-Corsair assistant reply — used when the determiner routes to agent
 * but requiresCorsairMcpTool is false (memory-enhanced chat only).
 */
export async function generateAssistantReply(input: {
  prompt: string;
  history: ThreadContextMessageModelType[];
  longTermMemories: LongTermMemoryModelType[];
  signal?: AbortSignal;
}): Promise<string> {
  const memoryBlock =
    input.longTermMemories.length > 0
      ? input.longTermMemories.map((m, i) => `[${i + 1}] ${m.memory}`).join("\n")
      : "";

  const userContent = [memoryBlock ? `Long-term memory:\n${memoryBlock}\n` : "", input.prompt]
    .filter(Boolean)
    .join("\n");

  try {
    return await completeChat({
      model: DIRECT_REPLY_MODEL,
      systemPrompt: DIRECT_REPLY_SYSTEM_PROMPT,
      messages: input.history.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      userPrompt: userContent,
      temperature: 0.3,
      signal: input.signal,
    });
  } catch {
    return "I couldn't generate a response.";
  }
}
