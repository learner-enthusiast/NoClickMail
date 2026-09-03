import { z } from "zod";

/** Mem0 long-term memory match returned from semantic search. */
export const longTermMemoryModel = z.object({
  id: z.string(),
  memory: z.string(),
  score: z.number(),
});

export type LongTermMemoryModelType = z.infer<typeof longTermMemoryModel>;

export const storeChatTurnInputModel = z.object({
  userId: z.uuid(),
  threadId: z.uuid(),
  messageId: z.uuid(),
  userContent: z.string().min(1),
  assistantContent: z.string().min(1),
});

export type StoreChatTurnInputModelType = z.infer<typeof storeChatTurnInputModel>;

export const searchLongTermMemoryInputModel = z.object({
  userId: z.uuid(),
  query: z.string().min(1),
  topK: z.number().int().positive().default(5),
});

export type SearchLongTermMemoryInputModelType = z.infer<typeof searchLongTermMemoryInputModel>;

export const mem0AddResultModel = z.object({
  queued: z.boolean().default(true),
  eventId: z.string().optional(),
});

export type Mem0AddResultModelType = z.infer<typeof mem0AddResultModel>;
