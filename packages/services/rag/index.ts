import { logger } from "@repo/logger";
import EmbeddingService from "./embeddings";
import PineconeVectorStore from "./pinecone";
import Mem0LongTermMemory from "./mem0";
import { buildThreadContext } from "./context";
import { enhanceUserPrompt } from "./prompt-enhancer";
import { determineRequest } from "./determiner";
import { resolveRoute } from "./determiner.model";
import { generateAssistantReply } from "./direct-response";
import type { ThreadContextMessageModelType } from "./context.model";
import type { LongTermMemoryModelType, StoreChatTurnInputModelType } from "./mem0/model";
import type {
  RagRunInputModelType,
  RagRunMetaModelType,
  RagRunResultModelType,
} from "./pipeline.model";
import {
  RAG_MEM0_TOP_K,
  RAG_TOP_K,
  type RetrieveContextInputModelType,
  type RetrievedChunkModelType,
} from "./retrieve.model";

/**
 * RAG orchestrator with determiner-based routing.
 *
 * Flow per user message:
 *   1. buildContext — last 10 thread messages from Postgres
 *   2. determiner     — classify request (Corsair / Mem0 / enhance / clarify / direct)
 *   3. conditional    — retrieve + enhance only when determiner flags require it
 *   4. storeChatTurn  — Mem0 memory after assistant reply (called from runAgent)
 */
class RagService {
  private readonly embeddings = new EmbeddingService();
  private readonly vectors = new PineconeVectorStore();
  private readonly longTermMemory = new Mem0LongTermMemory();

  isPineconeEnabled(): boolean {
    return this.vectors.isConfigured();
  }

  isMem0Enabled(): boolean {
    return this.longTermMemory.isConfigured();
  }

  async retrieve(input: RetrieveContextInputModelType): Promise<RetrievedChunkModelType[]> {
    if (!this.isPineconeEnabled()) return [];

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

  async retrieveLongTermMemory(
    userId: string,
    query: string,
    topK: number = RAG_MEM0_TOP_K,
  ): Promise<LongTermMemoryModelType[]> {
    if (!this.isMem0Enabled()) return [];

    return this.longTermMemory.search({ userId, query, topK });
  }

  async buildContext(userId: string, threadId: string): Promise<ThreadContextMessageModelType[]> {
    return buildThreadContext(userId, threadId);
  }

  async storeChatTurn(input: StoreChatTurnInputModelType): Promise<void> {
    if (!this.isMem0Enabled()) return;

    await this.longTermMemory.addChatTurn(input);
  }

  /** Generate a non-Corsair reply when determiner routes to agent without MCP tools. */
  async generateAssistantReply(
    input: {
      prompt: string;
      history: ThreadContextMessageModelType[];
      longTermMemories: LongTermMemoryModelType[];
    },
    signal?: AbortSignal,
  ): Promise<string> {
    return generateAssistantReply({ ...input, signal });
  }

  async runForUserMessage(
    input: RagRunInputModelType,
    signal?: AbortSignal,
  ): Promise<RagRunResultModelType> {
    const ranAt = new Date().toISOString();

    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const history = await this.buildContext(input.userId, input.threadId);

    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const determination = await determineRequest({
      history,
      prompt: input.prompt,
      signal,
    });

    const route = resolveRoute(determination);
    const runCorsairAgent = determination.requiresCorsairMcpTool;

    logger.info("RAG determiner decision", {
      userId: input.userId,
      threadId: input.threadId,
      route,
      runCorsairAgent,
      ...determination,
    });

    // Clarify — return the question immediately.
    if (route === "clarify") {
      const assistantMessage = determination.clarifyingQuestion!.trim();
      return {
        route,
        runCorsairAgent: false,
        assistantMessage,
        enhancedPrompt: input.prompt,
        retrieved: [],
        longTermMemories: [],
        history,
        meta: {
          ranAt,
          route,
          runCorsairAgent: false,
          determination,
          context: {
            messageCount: history.length,
            charBudget: history.reduce((n, m) => n + m.content.length, 0),
          },
        },
      };
    }

    // Direct — no tools, memory, or external retrieval needed.
    if (route === "direct") {
      const assistantMessage =
        determination.directResponse?.trim() ??
        "I'm here to help with email and calendar tasks. What would you like to do?";

      return {
        route,
        runCorsairAgent: false,
        assistantMessage,
        enhancedPrompt: input.prompt,
        retrieved: [],
        longTermMemories: [],
        history,
        meta: {
          ranAt,
          route,
          runCorsairAgent: false,
          determination,
          context: {
            messageCount: history.length,
            charBudget: history.reduce((n, m) => n + m.content.length, 0),
          },
        },
      };
    }

    // Agent — conditional retrieve + enhance based on determiner flags.
    let retrieved: RetrievedChunkModelType[] = [];
    let longTermMemories: LongTermMemoryModelType[] = [];

    if (determination.requiresExternalEnhancement || determination.requiresLongTermMemory) {
      [retrieved, longTermMemories] = await Promise.all([
        determination.requiresExternalEnhancement
          ? this.retrieve({
              userId: input.userId,
              query: input.prompt,
              topK: RAG_TOP_K,
              excludeMessageId: input.messageId,
            })
          : Promise.resolve([]),
        determination.requiresLongTermMemory
          ? this.retrieveLongTermMemory(input.userId, input.prompt, RAG_MEM0_TOP_K)
          : Promise.resolve([]),
      ]);
    }

    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const shouldEnhance =
      determination.requiresExternalEnhancement &&
      (retrieved.length > 0 || longTermMemories.length > 0);

    const enhancedPrompt = shouldEnhance
      ? await enhanceUserPrompt(input.prompt, retrieved, longTermMemories, signal)
      : input.prompt;

    const meta: RagRunMetaModelType = {
      ranAt,
      route,
      runCorsairAgent,
      determination,
      retrieve:
        determination.requiresExternalEnhancement && this.isPineconeEnabled()
          ? {
              topK: RAG_TOP_K,
              matchCount: retrieved.length,
              matches: retrieved.map((m) => ({
                id: m.id,
                score: m.score,
                textPreview: m.text.slice(0, 120),
                messageId: m.messageId,
              })),
            }
          : undefined,
      mem0:
        determination.requiresLongTermMemory && this.isMem0Enabled()
          ? {
              topK: RAG_MEM0_TOP_K,
              matchCount: longTermMemories.length,
              matches: longTermMemories.map((m) => ({
                id: m.id,
                score: m.score,
                memoryPreview: m.memory.slice(0, 120),
              })),
            }
          : undefined,
      enhance: shouldEnhance
        ? { originalPrompt: input.prompt, enhancedPrompt }
        : undefined,
      context: {
        messageCount: history.length,
        charBudget: history.reduce((n, m) => n + m.content.length, 0),
      },
    };

    logger.info("RAG pipeline complete", {
      userId: input.userId,
      threadId: input.threadId,
      route,
      runCorsairAgent,
      retrieveMatches: retrieved.length,
      mem0Matches: longTermMemories.length,
    });

    return {
      route,
      runCorsairAgent,
      enhancedPrompt,
      retrieved,
      longTermMemories,
      history,
      meta,
    };
  }
}

export default RagService;
