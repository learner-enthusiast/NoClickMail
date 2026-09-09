import { z } from "zod";

/** Mem0 long-term memory match returned from semantic search. */
export const longTermMemoryModel = z.object({
  id: z.string(),
  memory: z.string(),
  score: z.number(),
});

export type LongTermMemoryModelType = z.infer<typeof longTermMemoryModel>;

/** Payload for persisting a completed user+assistant turn to Mem0. */
export const persistMem0TurnInputModel = z.object({
  userId: z.uuid(),
  threadId: z.uuid(),
  messageId: z.uuid(),
  userContent: z.string().min(1),
  assistantContent: z.string().min(1),
});

export type PersistMem0TurnInputModelType = z.infer<typeof persistMem0TurnInputModel>;

/** Payload for searching a user's distilled Mem0 memories. */
export const searchMem0MemoriesInputModel = z.object({
  userId: z.uuid(),
  query: z.string().min(1),
  topK: z.number().int().positive().default(5),
});

export type SearchMem0MemoriesInputModelType = z.infer<typeof searchMem0MemoriesInputModel>;

export const mem0AddResultModel = z.object({
  queued: z.boolean().default(true),
  eventId: z.string().optional(),
});

export type Mem0AddResultModelType = z.infer<typeof mem0AddResultModel>;
