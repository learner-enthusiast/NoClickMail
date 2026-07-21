import { logger } from "@repo/logger";
import { env } from "../env";
import EmbeddingService from "../embeddings";
import PineconeVectorStore from "../pinecone";
import { chunkText } from "./chunk";
import type { IngestResultModelType, IngestUserMessageInputModelType } from "./model";

const embeddings = new EmbeddingService();
const vectors = new PineconeVectorStore();

export function ingestChunks(content: string): string[] {
  return chunkText(content, {
    maxChars: env.RAG_CHUNK_SIZE,
    overlap: env.RAG_CHUNK_OVERLAP,
  });
}

export async function embedChunks(chunks: string[]): Promise<number[][]> {
  return embeddings.embed(chunks);
}

export async function upsertIngestRecords(
  input: IngestUserMessageInputModelType,
  chunks: string[],
  chunkVectors: number[][],
): Promise<IngestResultModelType> {
  const started = Date.now();
  const createdAt = new Date().toISOString();
  const records = chunks.map((text, chunkIndex) => ({
    id: `${input.messageId}:${chunkIndex}`,
    values: chunkVectors[chunkIndex]!,
    metadata: {
      userId: input.userId,
      threadId: input.threadId,
      messageId: input.messageId,
      role: input.role,
      chunkIndex,
      text,
      createdAt,
    },
  }));

  await vectors.upsertMany(input.userId, records);

  const result: IngestResultModelType = {
    queued: false,
    chunkCount: chunks.length,
    vectorIds: records.map((r) => r.id),
    durationMs: Date.now() - started,
  };

  logger.info("RAG ingest complete", {
    userId: input.userId,
    threadId: input.threadId,
    messageId: input.messageId,
    ...result,
  });

  return result;
}

/** Synchronous ingest — used by Inngest worker steps and as a fallback. */
export async function runIngestUserMessage(
  input: IngestUserMessageInputModelType,
): Promise<IngestResultModelType> {
  const started = Date.now();
  const chunks = ingestChunks(input.content);

  if (chunks.length === 0) {
    return { queued: false, chunkCount: 0, vectorIds: [], durationMs: Date.now() - started };
  }

  const chunkVectors = await embedChunks(chunks);
  return upsertIngestRecords(input, chunks, chunkVectors);
}
