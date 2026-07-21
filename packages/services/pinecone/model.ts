import { z } from "zod";

export const vectorMetadataModel = z.object({
  userId: z.string(),
  threadId: z.string(),
  messageId: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  chunkIndex: z.number().int().nonnegative(),
  text: z.string(),
  createdAt: z.string(),
});

export type VectorMetadataModelType = z.infer<typeof vectorMetadataModel>;

export const upsertVectorInputModel = z.object({
  id: z.string(),
  values: z.array(z.number()),
  metadata: vectorMetadataModel,
});

export type UpsertVectorInputModelType = z.infer<typeof upsertVectorInputModel>;

export const queryVectorsInputModel = z.object({
  userId: z.string(),
  vector: z.array(z.number()),
  topK: z.number().int().positive().default(3),
  excludeMessageId: z.string().optional(),
});

export type QueryVectorsInputModelType = z.infer<typeof queryVectorsInputModel>;

export const vectorMatchModel = z.object({
  id: z.string(),
  score: z.number(),
  metadata: vectorMetadataModel,
});

export type VectorMatchModelType = z.infer<typeof vectorMatchModel>;
