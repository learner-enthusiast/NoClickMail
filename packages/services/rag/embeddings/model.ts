import { z } from "zod";

/** Zod schemas for embedding API inputs (batch embed up to 96 texts). */

export const embedTextsInputModel = z.object({
  texts: z.array(z.string().min(1)).min(1).max(96),
});

export type EmbedTextsInputModelType = z.infer<typeof embedTextsInputModel>;

export const embeddingVectorModel = z.array(z.number());

export type EmbeddingVectorModelType = z.infer<typeof embeddingVectorModel>;
