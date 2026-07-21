import { logger } from "@repo/logger";
import EmbeddingService from "../embeddings";
import PineconeVectorStore from "../pinecone";
import { inngest, isInngestEnabled } from "../inngest";
import { RAG_MESSAGE_INGEST_EVENT } from "../inngest/events";
import { runIngestUserMessage } from "./ingest-worker";
import { enhanceUserPrompt } from "./prompt-enhancer";
import {
  RAG_TOP_K,
  type IngestUserMessageInputModelType,
  type IngestResultModelType,
  type RagRunInputModelType,
  type RagRunMetaModelType,
  type RagRunResultModelType,
  type RetrieveContextInputModelType,
  type RetrievedChunkModelType,
} from "./model";

/**
 * Advanced RAG pipeline:
 * 1. Ingest — chunk user message → embed → upsert to Pinecone (via Inngest background job)
 * 2. Retrieve — top-k=3 similar chunks for the query
 * 3. Enhance — rewrite user prompt with retrieved memory before main agent
 */
class RagService {
  private readonly embeddings = new EmbeddingService();
  private readonly vectors = new PineconeVectorStore();

  isEnabled(): boolean {
    return this.vectors.isConfigured();
  }

  /** Queue or run ingest for a user message (Inngest when configured, else sync fallback). */
  async enqueueIngest(input: IngestUserMessageInputModelType): Promise<IngestResultModelType> {
    if (isInngestEnabled()) {
      const { ids } = await inngest.send({
        name: RAG_MESSAGE_INGEST_EVENT,
        data: input,
      });

      const result: IngestResultModelType = {
        queued: true,
        eventName: RAG_MESSAGE_INGEST_EVENT,
        messageId: input.messageId,
        eventIds: ids,
      };

      logger.info("RAG ingest queued", {
        userId: input.userId,
        threadId: input.threadId,
        messageId: input.messageId,
        eventIds: ids,
      });

      return result;
    }

    logger.warn("Inngest not configured — running RAG ingest synchronously");
    return runIngestUserMessage(input);
  }

  /** Fetch top-k relevant chunks for a query. */
  async retrieve(input: RetrieveContextInputModelType): Promise<RetrievedChunkModelType[]> {
    const queryVector = await this.embeddings.embedOne(input.query);
    const topK = input.topK ?? RAG_TOP_K;

    const matches = await this.vectors.query({
      userId: input.userId,
      vector: queryVector,
      topK: input.excludeMessageId ? topK + 2 : topK,
    });

    const filtered = input.excludeMessageId
      ? matches.filter((m) => m.metadata.messageId !== input.excludeMessageId)
      : matches;

    return filtered.slice(0, topK).map((m) => ({
      id: m.id,
      score: m.score,
      text: m.metadata.text,
      threadId: m.metadata.threadId,
      messageId: m.metadata.messageId,
      role: m.metadata.role,
      chunkIndex: m.metadata.chunkIndex,
    }));
  }

  /** Full pipeline for an incoming user message — queue ingest, retrieve k=3, enhance prompt. */
  async runForUserMessage(
    input: RagRunInputModelType,
    signal?: AbortSignal,
  ): Promise<RagRunResultModelType> {
    const ranAt = new Date().toISOString();
    const baseMeta: RagRunMetaModelType = { enabled: this.isEnabled(), ranAt };

    if (!this.isEnabled()) {
      logger.warn("RAG skipped — Pinecone not configured", { userId: input.userId });
      return {
        enhancedPrompt: input.prompt,
        retrieved: [],
        meta: {
          ...baseMeta,
          skippedReason: "PINECONE_API_KEY or PINECONE_INDEX not set",
        },
      };
    }

    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    logger.info("RAG pipeline starting", {
      userId: input.userId,
      threadId: input.threadId,
      messageId: input.messageId,
    });

    const ingest = await this.enqueueIngest({
      userId: input.userId,
      threadId: input.threadId,
      messageId: input.messageId,
      content: input.prompt,
      role: "user",
    });

    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const retrieved = await this.retrieve({
      userId: input.userId,
      query: input.prompt,
      topK: RAG_TOP_K,
      excludeMessageId: input.messageId,
    });

    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const enhancedPrompt = await enhanceUserPrompt(input.prompt, retrieved, signal);

    const meta: RagRunMetaModelType = {
      ...baseMeta,
      ingest,
      retrieve: {
        topK: RAG_TOP_K,
        matchCount: retrieved.length,
        matches: retrieved.map((m) => ({
          id: m.id,
          score: m.score,
          textPreview: m.text.slice(0, 120),
          messageId: m.messageId,
        })),
      },
      enhance: {
        originalPrompt: input.prompt,
        enhancedPrompt,
      },
    };

    logger.info("RAG pipeline complete", {
      userId: input.userId,
      threadId: input.threadId,
      ingestQueued: ingest.queued,
      ingestChunks: ingest.chunkCount,
      retrieveMatches: retrieved.length,
    });

    return { enhancedPrompt, retrieved, meta };
  }
}

export default RagService;
