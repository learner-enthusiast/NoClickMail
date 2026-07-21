import { Pinecone, type RecordMetadata } from "@pinecone-database/pinecone";
import { env } from "../env";
import type {
  QueryVectorsInputModelType,
  UpsertVectorInputModelType,
  VectorMatchModelType,
} from "./model";

/** Pinecone vector store — one namespace per user for tenant isolation. */
class PineconeVectorStore {
  private client: Pinecone | null = null;

  isConfigured(): boolean {
    return Boolean(env.PINECONE_API_KEY && env.PINECONE_INDEX);
  }

  private getClient(): Pinecone {
    if (!this.isConfigured()) {
      throw new Error("Pinecone is not configured (PINECONE_API_KEY / PINECONE_INDEX missing)");
    }
    if (!this.client) {
      this.client = new Pinecone({ apiKey: env.PINECONE_API_KEY! });
    }
    return this.client;
  }

  private index() {
    return this.getClient().index(env.PINECONE_INDEX!);
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
