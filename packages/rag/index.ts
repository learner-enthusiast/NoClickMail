import { logger } from "@repo/logger";
import { env } from "@repo/env";
import EmbeddingService from "./embeddings";
import PgVectorStore from "./pgvector";
import Mem0LongTermMemory from "./mem0";
import { buildThreadContext } from "./context";
import { chunkText } from "./chunk";
import { enhanceUserPrompt } from "./prompt-enhancer";
import { determineRequest } from "./determiner";
import { resolveRoute } from "@repo/rag-models/determiner.model";
import type { RequestDeterminationModelType } from "@repo/rag-models/determiner.model";
import { generateAssistantReply } from "./direct-response";
import { generateEmailDraft } from "./email-writer";
import type { ThreadContextMessageModelType } from "@repo/rag-models/context.model";
import type { LongTermMemoryModelType, PersistMem0TurnInputModelType } from "@repo/rag-models/mem0.model";
import type {
  RagRunInputModelType,
  RagRunMetaModelType,
  RagRunResultModelType,
} from "@repo/rag-models/pipeline.model";
import {
  RAG_MEM0_TOP_K,
  RAG_TOP_K,
  type RetrieveContextInputModelType,
  type RetrievedChunkModelType,
} from "@repo/rag-models/retrieve.model";
import type { UpsertVectorInputModelType } from "@repo/rag-models/vector-store.model";

/** Inputs shared by the full agent-route pipeline (retrieve → enhance → execute). */
type AgentRouteContext = {
  input: RagRunInputModelType;
  ranAt: string;
  route: RagRunResultModelType["route"];
  runCorsairAgent: boolean;
  runEmailWriterAgent: boolean;
  determination: RequestDeterminationModelType;
  history: ThreadContextMessageModelType[];
  signal?: AbortSignal;
};

/** Retrieval + prompt enhancement outputs for agent-route metadata. */
type AgentContextFetch = {
  retrieved: RetrievedChunkModelType[];
  longTermMemories: LongTermMemoryModelType[];
  enhancedPrompt: string;
  shouldEnhance: boolean;
};

/**
 * RAG orchestrator with determiner-based routing.
 *
 * Flow per user message:
 *   1. buildContext — last 10 thread messages from Postgres
 *   2. determiner     — classify request (Corsair / email writer / Mem0 / enhance / clarify / direct)
 *   3. conditional    — retrieve + enhance only when determiner flags require it
 *   4. saveTurnToLongTermMemoryIfEnabled — Mem0 write after assistant reply (called from runAgent)
 *   5. indexCompletedTurnForRetrieval — pgvector write after assistant reply (called from runAgent)
 */
class RagService {
  private readonly embeddings = new EmbeddingService();
  private readonly vectors = new PgVectorStore();
  private readonly longTermMemory = new Mem0LongTermMemory();

  isPgVectorEnabled(): boolean {
    return this.vectors.isConfigured();
  }

  isMem0Enabled(): boolean {
    return this.longTermMemory.isConfigured();
  }

  /** pgvector cosine search over embedded message chunks in Postgres. */
  async retrieve(input: RetrieveContextInputModelType): Promise<RetrievedChunkModelType[]> {
    if (!this.isPgVectorEnabled()) return [];

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

  /** Mem0 READ — fetch distilled long-term memories for the current prompt. */
  async fetchMem0MemoriesForPrompt(
    userId: string,
    query: string,
    topK: number = RAG_MEM0_TOP_K,
  ): Promise<LongTermMemoryModelType[]> {
    if (!this.isMem0Enabled()) return [];

    return this.longTermMemory.searchUserLongTermMemories({ userId, query, topK });
  }

  /** Recent in-thread conversation from Postgres (not Mem0). */
  async buildContext(userId: string, threadId: string): Promise<ThreadContextMessageModelType[]> {
    return buildThreadContext(userId, threadId);
  }

  /**
   * Mem0 WRITE — persist a completed turn after the assistant reply is saved.
   *
   * No-op when MEM0_API_KEY is missing. Failures inside Mem0 are logged, not thrown.
   */
  async saveTurnToLongTermMemoryIfEnabled(input: PersistMem0TurnInputModelType): Promise<void> {
    if (!this.isMem0Enabled()) return;

    await this.longTermMemory.persistCompletedTurnToMem0(input);
  }

  /**
   * pgvector WRITE — chunk, embed, and upsert a completed turn for later retrieval.
   *
   * Indexes both the user prompt and assistant reply. Failures are logged, not thrown.
   */
  async indexCompletedTurnForRetrieval(input: {
    userId: string;
    threadId: string;
    userMessageId: string;
    assistantMessageId: string;
    userContent: string;
    assistantContent: string;
  }): Promise<void> {
    try {
      const chunkOpts = { maxChars: env.RAG_CHUNK_SIZE, overlap: env.RAG_CHUNK_OVERLAP };
      const createdAt = new Date().toISOString();
      const messages = [
        { messageId: input.userMessageId, role: "user" as const, content: input.userContent },
        {
          messageId: input.assistantMessageId,
          role: "assistant" as const,
          content: input.assistantContent,
        },
      ];

      const records: UpsertVectorInputModelType[] = [];
      const textsToEmbed: string[] = [];

      for (const message of messages) {
        const chunks = chunkText(message.content, chunkOpts);
        chunks.forEach((text, chunkIndex) => {
          textsToEmbed.push(text);
          records.push({
            id: `${message.messageId}:${chunkIndex}`,
            values: [],
            metadata: {
              userId: input.userId,
              threadId: input.threadId,
              messageId: message.messageId,
              role: message.role,
              chunkIndex,
              text,
              createdAt,
            },
          });
        });
      }

      if (textsToEmbed.length === 0) return;

      const vectors = await this.embeddings.embed(textsToEmbed);
      records.forEach((record, index) => {
        record.values = vectors[index] ?? [];
      });

      const validRecords = records.filter((record) => record.values.length > 0);
      await this.vectors.upsertMany(input.userId, validRecords);
    } catch (error) {
      logger.error("Failed to index chat turn for pgvector retrieval", {
        error,
        userId: input.userId,
        threadId: input.threadId,
        userMessageId: input.userMessageId,
        assistantMessageId: input.assistantMessageId,
      });
    }
  }

  /** Generate polished email copy when the determiner routes to the email writer agent. */
  async generateEmailDraft(
    input: {
      prompt: string;
      enhancedPrompt: string;
      history: ThreadContextMessageModelType[];
      retrieved: RetrievedChunkModelType[];
      longTermMemories: LongTermMemoryModelType[];
    },
    signal?: AbortSignal,
  ): Promise<string> {
    return generateEmailDraft({ ...input, signal });
  }

  /** Generate a non-Corsair reply when the determiner routes to agent without MCP tools. */
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

  private contextStats(history: ThreadContextMessageModelType[]) {
    return {
      messageCount: history.length,
      charBudget: history.reduce((n, m) => n + m.content.length, 0),
    };
  }

  /** Build result for clarify/direct routes — no retrieval or agent execution. */
  private buildImmediateReplyResult(
    ranAt: string,
    route: "clarify" | "direct",
    input: RagRunInputModelType,
    history: ThreadContextMessageModelType[],
    determination: RequestDeterminationModelType,
    assistantMessage: string,
  ): RagRunResultModelType {
    return {
      route,
      runCorsairAgent: false,
      runEmailWriterAgent: false,
      assistantMessage,
      enhancedPrompt: input.prompt,
      retrieved: [],
      longTermMemories: [],
      history,
      meta: {
        ranAt,
        route,
        runCorsairAgent: false,
        runEmailWriterAgent: false,
        determination,
        context: this.contextStats(history),
      },
    };
  }

  /**
   * Parallel pgvector + Mem0 retrieval when the determiner requests them.
   * Returns empty arrays when the corresponding flag is false.
   */
  private async retrieveEmbeddingsAndMem0IfNeeded(
    input: RagRunInputModelType,
    determination: RequestDeterminationModelType,
  ): Promise<{
    retrieved: RetrievedChunkModelType[];
    longTermMemories: LongTermMemoryModelType[];
  }> {
    if (!determination.requiresExternalEnhancement && !determination.requiresLongTermMemory) {
      return { retrieved: [], longTermMemories: [] };
    }

    const [retrieved, longTermMemories] = await Promise.all([
      determination.requiresExternalEnhancement
        ? this.retrieve({
            userId: input.userId,
            query: input.prompt,
            topK: RAG_TOP_K,
            excludeMessageId: input.messageId,
          })
        : Promise.resolve([]),
      determination.requiresLongTermMemory
        ? this.fetchMem0MemoriesForPrompt(input.userId, input.prompt, RAG_MEM0_TOP_K)
        : Promise.resolve([]),
    ]);

    return { retrieved, longTermMemories };
  }

  private buildAgentMeta(ctx: AgentRouteContext, fetch: AgentContextFetch): RagRunMetaModelType {
    const { input, ranAt, route, runCorsairAgent, runEmailWriterAgent, determination, history } =
      ctx;
    const { retrieved, longTermMemories, enhancedPrompt, shouldEnhance } = fetch;

    return {
      ranAt,
      route,
      runCorsairAgent,
      runEmailWriterAgent,
      determination,
      retrieve:
        determination.requiresExternalEnhancement && this.isPgVectorEnabled()
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
      enhance: shouldEnhance ? { originalPrompt: input.prompt, enhancedPrompt } : undefined,
      context: this.contextStats(history),
    };
  }

  /**
   * Full agent-route pipeline: retrieve context → enhance prompt → return execution flags.
   * Does not generate the assistant reply or write to Mem0.
   */
  private async prepareFullAgentPipelineResult(
    ctx: AgentRouteContext,
  ): Promise<RagRunResultModelType> {
    const {
      input,
      ranAt,
      route,
      runCorsairAgent,
      runEmailWriterAgent,
      determination,
      history,
      signal,
    } = ctx;

    const { retrieved, longTermMemories } = await this.retrieveEmbeddingsAndMem0IfNeeded(
      input,
      determination,
    );

    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const shouldEnhance =
      determination.requiresExternalEnhancement &&
      (retrieved.length > 0 || longTermMemories.length > 0);

    const enhancedPrompt = shouldEnhance
      ? await enhanceUserPrompt(input.prompt, retrieved, longTermMemories, signal)
      : input.prompt;

    const meta = this.buildAgentMeta(ctx, {
      retrieved,
      longTermMemories,
      enhancedPrompt,
      shouldEnhance,
    });

    logger.info("RAG pipeline complete", {
      userId: input.userId,
      threadId: input.threadId,
      route,
      runCorsairAgent,
      runEmailWriterAgent,
      retrieveMatches: retrieved.length,
      mem0Matches: longTermMemories.length,
    });

    return {
      route,
      runCorsairAgent,
      runEmailWriterAgent,
      enhancedPrompt,
      retrieved,
      longTermMemories,
      history,
      meta,
    };
  }

  /**
   * Classify the user message and prepare execution context.
   *
   * Steps:
   *   1. Load recent thread history from Postgres
   *   2. Run determiner LLM → route + flags
   *   3. clarify/direct → return pre-built reply
   *   4. agent → retrieve pgvector/Mem0 and enhance prompt
   *
   * Mem0 WRITE happens later via saveTurnToLongTermMemoryIfEnabled (after assistant reply).
   */
  async classifyAndPrepareAgentContext(
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
    const runEmailWriterAgent = determination.requiresEmailWriterAgent;

    logger.info("RAG determiner decision", {
      userId: input.userId,
      threadId: input.threadId,
      route,
      runCorsairAgent,
      runEmailWriterAgent,
      ...determination,
    });

    if (route === "clarify") {
      return this.buildImmediateReplyResult(
        ranAt,
        route,
        input,
        history,
        determination,
        determination.clarifyingQuestion!.trim(),
      );
    }

    if (route === "direct") {
      const assistantMessage =
        determination.directResponse?.trim() ??
        "I'm here to help with email and calendar tasks. What would you like to do?";

      return this.buildImmediateReplyResult(
        ranAt,
        route,
        input,
        history,
        determination,
        assistantMessage,
      );
    }

    return this.prepareFullAgentPipelineResult({
      input,
      ranAt,
      route,
      runCorsairAgent,
      runEmailWriterAgent,
      determination,
      history,
      signal,
    });
  }
}

export default RagService;
