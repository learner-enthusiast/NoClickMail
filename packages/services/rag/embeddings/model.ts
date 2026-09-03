import { z } from "zod";

export const embedTextsInputModel = z.object({
  texts: z.array(z.string().min(1)).min(1).max(96),
});

export type EmbedTextsInputModelType = z.infer<typeof embedTextsInputModel>;

export const embeddingVectorModel = z.array(z.number());

export type EmbeddingVectorModelType = z.infer<typeof embeddingVectorModel>;
