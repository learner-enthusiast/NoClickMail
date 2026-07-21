import { z } from "zod";
import { vectorMatchModel } from "../pinecone/model";

export const RAG_TOP_K = 3;

export const ingestUserMessageInputModel = z.object({
  userId: z.string().uuid(),
  threadId: z.string().uuid(),
  messageId: z.string().uuid(),
  content: z.string().min(1),
  role: z.enum(["user", "assistant", "system"]).default("user"),
});

export type IngestUserMessageInputModelType = z.infer<typeof ingestUserMessageInputModel>;

export const ingestResultModel = z.object({
  /** true when ingest was queued to Inngest (background worker) */
  queued: z.boolean().default(false),
  chunkCount: z.number().int().nonnegative().optional(),
  vectorIds: z.array(z.string()).optional(),
  durationMs: z.number().optional(),
  eventName: z.string().optional(),
  messageId: z.string().uuid().optional(),
  eventIds: z.array(z.string()).optional(),
});

export type IngestResultModelType = z.infer<typeof ingestResultModel>;

export const retrieveContextInputModel = z.object({
  userId: z.string().uuid(),
  query: z.string().min(1),
  topK: z.number().int().positive().default(RAG_TOP_K),
  excludeMessageId: z.string().uuid().optional(),
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

export const enhancePromptInputModel = z.object({
  userPrompt: z.string().min(1),
  retrieved: z.array(retrievedChunkModel),
});

export type EnhancePromptInputModelType = z.infer<typeof enhancePromptInputModel>;

export const ragRunInputModel = z.object({
  userId: z.string().uuid(),
  threadId: z.string().uuid(),
  messageId: z.string().uuid(),
  prompt: z.string().min(1),
});

export type RagRunInputModelType = z.infer<typeof ragRunInputModel>;

export const ragRunMetaModel = z.object({
  enabled: z.boolean(),
  ranAt: z.string(),
  skippedReason: z.string().optional(),
  ingest: ingestResultModel.optional(),
  retrieve: z
    .object({
      topK: z.number(),
      matchCount: z.number(),
      matches: z.array(
        z.object({
          id: z.string(),
          score: z.number(),
          textPreview: z.string(),
          messageId: z.string(),
        }),
      ),
    })
    .optional(),
  enhance: z
    .object({
      originalPrompt: z.string(),
      enhancedPrompt: z.string(),
    })
    .optional(),
});

export type RagRunMetaModelType = z.infer<typeof ragRunMetaModel>;

export const ragRunResultModel = z.object({
  enhancedPrompt: z.string(),
  retrieved: z.array(retrievedChunkModel),
  meta: ragRunMetaModel,
});

export type RagRunResultModelType = z.infer<typeof ragRunResultModel>;

// Re-export for consumers
export { vectorMatchModel };
