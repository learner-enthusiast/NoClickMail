import { logger } from "@repo/logger";
import { env } from "../../env";
import type {
  LongTermMemoryModelType,
  Mem0AddResultModelType,
  SearchLongTermMemoryInputModelType,
  StoreChatTurnInputModelType,
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
 * and stores them scoped by `user_id`. Unlike Pinecone chunk retrieval
 * (raw message text), Mem0 returns distilled memory statements.
 *
 * Requires MEM0_API_KEY from https://app.mem0.ai
 */
class Mem0LongTermMemory {
  isConfigured(): boolean {
    return Boolean(env.MEM0_API_KEY);
  }

  private async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
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
   * Store a completed chat turn. Mem0 LLM-extracts facts from the exchange
   * and merges them into the user's long-term memory graph.
   *
   * Called after the assistant reply is persisted (see agentsRouter.runAgent).
   */
  async addChatTurn(input: StoreChatTurnInputModelType): Promise<Mem0AddResultModelType | null> {
    if (!this.isConfigured()) return null;

    try {
      const json = await this.request<Mem0AddResponse>("/memories/add/", {
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
      logger.error("Mem0 addChatTurn failed", {
        error,
        userId: input.userId,
        threadId: input.threadId,
        messageId: input.messageId,
      });
      return null;
    }
  }

  /**
   * Semantic search over a user's long-term memories.
   * Used during RAG retrieve stage before prompt enhancement.
   */
  async search(input: SearchLongTermMemoryInputModelType): Promise<LongTermMemoryModelType[]> {
    if (!this.isConfigured()) return [];

    try {
      const json = await this.request<Mem0SearchResponse>("/memories/search/", {
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
      logger.error("Mem0 search failed", { error, userId: input.userId });
      return [];
    }
  }
}

export default Mem0LongTermMemory;
