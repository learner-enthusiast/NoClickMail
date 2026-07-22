import { Pinecone, type RecordMetadata } from "@pinecone-database/pinecone";
import { env } from "../env";
import type {
  PineconeConfigModelType,
  QueryVectorsInputModelType,
  UpsertVectorInputModelType,
  VectorMatchModelType,
} from "./model";

export type { PineconeConfigModelType } from "./model";

/**
 * Pinecone vector store — one namespace per user (or course) for isolation.
 *
 * Pass `apiKey` + `index` to target a different Pinecone project/index than the
 * default env vars (e.g. course RAG vs Orion chat RAG).
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

  /** Generic upsert for arbitrary namespaces + metadata (e.g. course RAG). */
  async upsertRecords(
    namespaceId: string,
    records: Array<{ id: string; values: number[]; metadata: RecordMetadata }>,
  ): Promise<number> {
    if (records.length === 0) return 0;

    const namespace = this.index().namespace(namespaceId);
    await namespace.upsert({ records });
    return records.length;
  }

  async deleteByIds(namespaceId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const namespace = this.index().namespace(namespaceId);
    await namespace.deleteMany({ ids });
  }

  async queryRecords(
    namespaceId: string,
    vector: number[],
    topK: number,
  ): Promise<Array<{ id: string; score: number; metadata: RecordMetadata }>> {
    const namespace = this.index().namespace(namespaceId);
    const result = await namespace.query({
      vector,
      topK,
      includeMetadata: true,
    });

    return (result.matches ?? [])
      .filter((m) => m.metadata)
      .map((m) => ({
        id: m.id ?? "",
        score: m.score ?? 0,
        metadata: m.metadata as RecordMetadata,
      }));
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
