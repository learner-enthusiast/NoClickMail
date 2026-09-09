CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "rag_embedding_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"role" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"text" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rag_embedding_chunks" ADD CONSTRAINT "rag_embedding_chunks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "rag_embedding_chunks" ADD CONSTRAINT "rag_embedding_chunks_thread_id_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_threads"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "rag_embedding_chunks_user_id_idx" ON "rag_embedding_chunks" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "rag_embedding_chunks_message_id_idx" ON "rag_embedding_chunks" USING btree ("message_id");
--> statement-breakpoint
CREATE INDEX "rag_embedding_chunks_embedding_hnsw_idx" ON "rag_embedding_chunks" USING hnsw ("embedding" vector_cosine_ops);
