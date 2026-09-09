import { customType, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { chatThreads } from "./chat";
import { usersTable } from "./user";

/** pgvector column — dimensions must match OPENAI_EMBEDDING_DIMENSIONS (default 1536). */
export const embeddingVector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value: number[]) {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string) {
    return value
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map(Number);
  },
});

/** Embedded chat message chunks for pgvector RAG retrieval. */
export const ragEmbeddingChunks = pgTable(
  "rag_embedding_chunks",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => chatThreads.id, { onDelete: "cascade" }),
    messageId: uuid("message_id").notNull(),
    role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    text: text("text").notNull(),
    embedding: embeddingVector("embedding").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("rag_embedding_chunks_user_id_idx").on(t.userId),
    index("rag_embedding_chunks_message_id_idx").on(t.messageId),
    index("rag_embedding_chunks_embedding_hnsw_idx").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops"),
    ),
  ],
);

export type SelectRagEmbeddingChunk = typeof ragEmbeddingChunks.$inferSelect;
export type InsertRagEmbeddingChunk = typeof ragEmbeddingChunks.$inferInsert;
