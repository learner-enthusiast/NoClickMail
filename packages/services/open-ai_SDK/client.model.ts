import type { z } from "zod";

export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type StructuredOutputDto<T extends z.ZodType = z.ZodType> = {
  name: string;
  zodSchema: T;
  jsonSchema: Record<string, unknown>;
  strict?: boolean;
};

export type CompleteChatBase = {
  model: string;
  systemPrompt?: string;
  messages?: ChatMessage[];
  userPrompt?: string;
  temperature?: number;
  signal?: AbortSignal;
};

export type CompleteChatInput<T extends z.ZodType | undefined = undefined> = CompleteChatBase &
  (T extends z.ZodType
    ? { outputDto: StructuredOutputDto<T> }
    : { outputDto?: undefined });

export type ChatCompletionResponse = {
  choices?: { message?: { content?: string } }[];
};

export type EmbeddingResponse = {
  data: { embedding: number[]; index: number }[];
};
