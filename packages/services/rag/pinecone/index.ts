import { Pinecone, type RecordMetadata } from "@pinecone-database/pinecone";
import { env } from "../../env";
import type {
  PineconeConfigModelType,
  QueryVectorsInputModelType,
  UpsertVectorInputModelType,
  VectorMatchModelType,
} from "./model";

export type { PineconeConfigModelType } from "./model";

/**
 * Pinecone vector store — one namespace per user for isolation.
 */
class PineconeVectorStore {
  private client: Pinecone | null = null;
  private readonly apiKey: string | undefined;
  private readonly indexName: string | undefined;

  constructor(config: PineconeConfigModelType = {}) {
    this.apiKey = config.apiKey ?? env.PINECONE_API_KEY;
    this.indexName = config.index ?? env.PINECONE_INDEX;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.indexName);
  }

  /** Resolved index name (after env fallback). */
  getIndexName(): string | undefined {
    return this.indexName;
  }

  private getClient(): Pinecone {
    if (!this.isConfigured()) {
      throw new Error("Pinecone is not configured (apiKey / index missing)");
    }
    if (!this.client) {
      this.client = new Pinecone({ apiKey: this.apiKey! });
    }
    return this.client;
  }

  private index() {
    return this.getClient().index(this.indexName!);
  }

  async upsertMany(userId: string, records: UpsertVectorInputModelType[]): Promise<number> {
    if (records.length === 0) return 0;

    const namespace = this.index().namespace(userId);
    await namespace.upsert({
      records: records.map((r) => ({
        id: r.id,
        values: r.values,
        metadata: r.metadata as unknown as RecordMetadata,
      })),
    });
    return records.length;
  }

  async query(input: QueryVectorsInputModelType): Promise<VectorMatchModelType[]> {
    const namespace = this.index().namespace(input.userId);
    const result = await namespace.query({
      vector: input.vector,
      topK: input.topK,
      includeMetadata: true,
    });

    return (result.matches ?? [])
      .filter((m) => m.metadata && typeof m.metadata.text === "string")
      .map((m) => ({
        id: m.id ?? "",
        score: m.score ?? 0,
        metadata: {
          userId: String(m.metadata!.userId),
          threadId: String(m.metadata!.threadId),
          messageId: String(m.metadata!.messageId),
          role: m.metadata!.role as "user" | "assistant" | "system",
          chunkIndex: Number(m.metadata!.chunkIndex),
          text: String(m.metadata!.text),
          createdAt: String(m.metadata!.createdAt),
        },
      }));
  }
}

export default PineconeVectorStore;
