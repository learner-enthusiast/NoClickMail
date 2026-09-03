import { z } from "zod";

/** Number of similar Pinecone chunks retrieved per query. */
export const RAG_TOP_K = 3;

/** Number of Mem0 long-term memories retrieved per query. */
export const RAG_MEM0_TOP_K = 5;

export const retrieveContextInputModel = z.object({
  userId: z.uuid(),
  query: z.string().min(1),
  topK: z.number().int().positive().default(RAG_TOP_K),
  excludeMessageId: z.uuid().optional(),
});

export type RetrieveContextInputModelType = z.infer<typeof retrieveContextInputModel>;

export const retrievedChunkModel = z.object({
  id: z.string(),
  score: z.number(),
  text: z.string(),
  threadId: z.string(),
  messageId: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  chunkIndex: z.number(),
});

export type RetrievedChunkModelType = z.infer<typeof retrievedChunkModel>;
