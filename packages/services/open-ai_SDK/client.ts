import { z } from "zod";
import { env } from "../env";
import { internal } from "../error";
import type {
  ChatCompletionResponse,
  ChatMessage,
  CompleteChatBase,
  CompleteChatInput,
  EmbeddingResponse,
} from "./client.model";

export type {
  ChatMessage,
  ChatRole,
  CompleteChatInput,
  StructuredOutputDto,
} from "./client.model";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";

function buildMessages(input: CompleteChatBase): ChatMessage[] {
  const messages: ChatMessage[] = [];

  if (input.systemPrompt) {
    messages.push({ role: "system", content: input.systemPrompt });
  }

  if (input.messages?.length) {
    messages.push(...input.messages);
  }

  if (input.userPrompt) {
    messages.push({ role: "user", content: input.userPrompt });
  }

  if (messages.length === 0) {
    throw internal("completeChat requires systemPrompt, messages, or userPrompt");
  }

  return messages;
}

async function openAiFetch<T>(
  url: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    signal,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw internal(`OpenAI request failed: ${res.status} ${text.slice(0, 200)}`);
  }

  return (await res.json()) as T;
}

/** Universal chat completion — plain text or Zod-validated structured JSON. */
export async function completeChat<T extends z.ZodType>(
  input: CompleteChatInput<T>,
): Promise<z.infer<T>>;
export async function completeChat(input: CompleteChatInput): Promise<string>;
export async function completeChat(
  input: CompleteChatInput<z.ZodType | undefined>,
): Promise<string | z.infer<z.ZodType>> {
  const body: Record<string, unknown> = {
    model: input.model,
    messages: buildMessages(input),
  };

  if (input.temperature !== undefined) {
    body.temperature = input.temperature;
  }

  if (input.outputDto) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: input.outputDto.name,
        strict: input.outputDto.strict ?? true,
        schema: input.outputDto.jsonSchema,
      },
    };
  }

  const json = await openAiFetch<ChatCompletionResponse>(OPENAI_CHAT_URL, body, input.signal);
  const raw = json.choices?.[0]?.message?.content;

  if (!raw?.trim()) {
    throw internal("OpenAI chat completion returned empty content");
  }

  if (input.outputDto) {
    return input.outputDto.zodSchema.parse(JSON.parse(raw));
  }

  return raw.trim();
}

/** Batch-create embedding vectors via OpenAI embeddings API. */
export async function createEmbeddings(
  texts: string[],
  opts?: {
    model?: string;
    dimensions?: number;
    signal?: AbortSignal;
  },
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const json = await openAiFetch<EmbeddingResponse>(
    OPENAI_EMBEDDINGS_URL,
    {
      model: opts?.model ?? env.OPENAI_EMBEDDING_MODEL,
      input: texts,
      dimensions: opts?.dimensions ?? env.OPENAI_EMBEDDING_DIMENSIONS,
    },
    opts?.signal,
  );

  return json.data.sort((a, b) => a.index - b.index).map((row) => row.embedding);
}

/** Single-text embedding convenience wrapper. */
export async function createEmbedding(
  text: string,
  opts?: Parameters<typeof createEmbeddings>[1],
): Promise<number[]> {
  const [vector] = await createEmbeddings([text], opts);
  if (!vector) throw internal("Embedding returned empty vector");
  return vector;
}
