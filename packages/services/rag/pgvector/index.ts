import db, { sql } from "@repo/database";
import { ragEmbeddingChunks } from "@repo/database/schema";
import type {
  QueryVectorsInputModelType,
  UpsertVectorInputModelType,
  VectorMatchModelType,
} from "../vector-store/model";

type PgVectorQueryRow = {
  id: string;
  user_id: string;
  thread_id: string;
  message_id: string;
  role: string;
  chunk_index: number;
  text: string;
  created_at: Date | string;
  score: number;
};

/**
 * PostgreSQL pgvector store for RAG chunk retrieval.
 *
 * Tenant isolation: all queries filter by user_id. Embeddings live in the
 * same Postgres database as chat messages (rag_embedding_chunks table).
 *
 * Record shape:
 *   id       — `{messageId}:{chunkIndex}`
 *   embedding — vector(1536) cosine-indexed via HNSW
 *   text     — chunk content used in prompt enhancement
 */
class PgVectorStore {
  /** pgvector uses the app database — always available when DATABASE_URL is set. */
  isConfigured(): boolean {
    return true;
  }

  /** Batch upsert embedded chunks for a user (conflict replaces text + embedding). */
  async upsertMany(userId: string, records: UpsertVectorInputModelType[]): Promise<number> {
    if (records.length === 0) return 0;

    await db
      .insert(ragEmbeddingChunks)
      .values(
        records.map((record) => ({
          id: record.id,
          userId,
          threadId: record.metadata.threadId,
          messageId: record.metadata.messageId,
          role: record.metadata.role,
          chunkIndex: record.metadata.chunkIndex,
          text: record.metadata.text,
          embedding: record.values,
        })),
      )
      .onConflictDoUpdate({
        target: ragEmbeddingChunks.id,
        set: {
          text: sql`excluded.text`,
          embedding: sql`excluded.embedding`,
        },
      });

    return records.length;
  }

  /**
   * Cosine similarity search — returns top-k chunks ranked by score (higher = closer).
   * Uses pgvector `<=>` cosine distance operator.
   */
  async query(input: QueryVectorsInputModelType): Promise<VectorMatchModelType[]> {
    const vectorLiteral = `[${input.vector.join(",")}]`;
    const excludeClause = input.excludeMessageId
      ? sql`AND message_id != ${input.excludeMessageId}::uuid`
      : sql``;

    const result = await db.execute<PgVectorQueryRow>(sql`
      SELECT
        id,
        user_id,
        thread_id,
        message_id,
        role,
        chunk_index,
        text,
        created_at,
        1 - (embedding <=> ${vectorLiteral}::vector) AS score
      FROM rag_embedding_chunks
      WHERE user_id = ${input.userId}::uuid
      ${excludeClause}
      ORDER BY embedding <=> ${vectorLiteral}::vector
      LIMIT ${input.topK}
    `);

    return result.rows.map((row) => ({
      id: row.id,
      score: Number(row.score),
      metadata: {
        userId: row.user_id,
        threadId: row.thread_id,
        messageId: row.message_id,
        role: row.role as "user" | "assistant" | "system",
        chunkIndex: row.chunk_index,
        text: row.text,
        createdAt:
          row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      },
    }));
  }
}

export default PgVectorStore;
