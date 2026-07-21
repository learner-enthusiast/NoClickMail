import type { IngestUserMessageInputModelType } from "../rag/model";

/** Fired on every user message — durable background chunk → embed → Pinecone upsert. */
export const RAG_MESSAGE_INGEST_EVENT = "rag/message.ingest" as const;

export type RagMessageIngestEvent = {
  name: typeof RAG_MESSAGE_INGEST_EVENT;
  data: IngestUserMessageInputModelType;
};
