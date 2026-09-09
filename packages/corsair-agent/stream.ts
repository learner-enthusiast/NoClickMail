import type { RunStreamEvent } from "@openai/agents";

/** Extract assistant text deltas from OpenAI Agents SDK stream events. */
export function extractAgentTextDelta(event: RunStreamEvent): string | null {
  if (event.type !== "raw_model_stream_event") return null;
  const data = event.data as { type?: string; delta?: string };
  if (data.type === "output_text_delta" && typeof data.delta === "string") {
    return data.delta;
  }
  return null;
}
