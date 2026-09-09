import { logger } from "@repo/logger";
import { env } from "../../env";
import type {
  LongTermMemoryModelType,
  Mem0AddResultModelType,
  PersistMem0TurnInputModelType,
  SearchMem0MemoriesInputModelType,
} from "./model";

const MEM0_API_BASE = "https://api.mem0.ai/v3";

type Mem0SearchResponse = {
  results?: {
    id?: string;
    memory?: string;
    score?: number;
  }[];
};

type Mem0AddResponse = {
  status?: string;
  eventId?: string;
  event_id?: string;
};

/**
 * Mem0 Platform client — per-user long-term memory.
 *
 * Mem0 extracts durable facts from chat turns (preferences, names, tasks)
 * and stores them scoped by `user_id`. Unlike pgvector chunk retrieval
 * (raw message text), Mem0 returns distilled memory statements.
 *
 * Requires MEM0_API_KEY from https://app.mem0.ai
 */
class Mem0LongTermMemory {
  /** True when MEM0_API_KEY is present in environment. */
  isConfigured(): boolean {
    return Boolean(env.MEM0_API_KEY);
  }

  /** POST helper for Mem0 REST endpoints. */
  private async postToMem0Api<T>(path: string, body: Record<string, unknown>): Promise<T> {
    if (!env.MEM0_API_KEY) {
      throw new Error("Mem0 is not configured (MEM0_API_KEY missing)");
    }

    const res = await fetch(`${MEM0_API_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Token ${env.MEM0_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Mem0 API ${path} failed: ${res.status} ${text.slice(0, 200)}`);
    }

    return (await res.json()) as T;
  }

  /**
   * WRITE path — queue a completed chat turn for Mem0 fact extraction.
   *
   * Sends the raw user+assistant exchange to Mem0. Mem0's LLM distills
   * durable facts and merges them into the user's long-term memory graph.
   *
   * Called after the assistant reply is saved to Postgres (see agentsRouter.runAgent).
   */
  async persistCompletedTurnToMem0(
    input: PersistMem0TurnInputModelType,
  ): Promise<Mem0AddResultModelType | null> {
    if (!this.isConfigured()) return null;

    try {
      const json = await this.postToMem0Api<Mem0AddResponse>("/memories/add/", {
        messages: [
          { role: "user", content: input.userContent },
          { role: "assistant", content: input.assistantContent },
        ],
        user_id: input.userId,
        metadata: {
          thread_id: input.threadId,
          message_id: input.messageId,
        },
      });

      const eventId = json.eventId ?? json.event_id;

      logger.info("Mem0 chat turn queued", {
        userId: input.userId,
        threadId: input.threadId,
        messageId: input.messageId,
        eventId,
      });

      return { queued: true, eventId };
    } catch (error) {
      logger.error("Mem0 persistCompletedTurnToMem0 failed", {
        error,
        userId: input.userId,
        threadId: input.threadId,
        messageId: input.messageId,
      });
      return null;
    }
  }

  /**
   * READ path — semantic search over a user's long-term Mem0 memories.
   *
   * Used during the RAG agent route when the determiner sets
   * requiresLongTermMemory=true.
   */
  async searchUserLongTermMemories(
    input: SearchMem0MemoriesInputModelType,
  ): Promise<LongTermMemoryModelType[]> {
    if (!this.isConfigured()) return [];

    try {
      const json = await this.postToMem0Api<Mem0SearchResponse>("/memories/search/", {
        query: input.query,
        filters: { user_id: input.userId },
        top_k: input.topK,
      });

      return (json.results ?? [])
        .filter((row) => row.id && row.memory)
        .map((row) => ({
          id: row.id!,
          memory: row.memory!,
          score: row.score ?? 0,
        }));
    } catch (error) {
      logger.error("Mem0 searchUserLongTermMemories failed", { error, userId: input.userId });
      return [];
    }
  }
}

export default Mem0LongTermMemory;
