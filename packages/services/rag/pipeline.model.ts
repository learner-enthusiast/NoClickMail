import { z } from "zod";
import { requestDeterminationModel } from "./determiner.model";
import { longTermMemoryModel } from "./mem0/model";
import { retrievedChunkModel } from "./retrieve.model";
import { threadContextMessageModel } from "./context.model";

export const ragRunInputModel = z.object({
  userId: z.uuid(),
  threadId: z.uuid(),
  messageId: z.uuid(),
  prompt: z.string().min(1),
});

export type RagRunInputModelType = z.infer<typeof ragRunInputModel>;

export const ragRunMetaModel = z.object({
  ranAt: z.string(),
  route: z.enum(["clarify", "direct", "agent"]),
  runCorsairAgent: z.boolean(),
  determination: requestDeterminationModel,
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
  mem0: z
    .object({
      topK: z.number(),
      matchCount: z.number(),
      matches: z.array(
        z.object({
          id: z.string(),
          score: z.number(),
          memoryPreview: z.string(),
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
  context: z
    .object({
      messageCount: z.number(),
      charBudget: z.number(),
    })
    .optional(),
});

export type RagRunMetaModelType = z.infer<typeof ragRunMetaModel>;

export const ragRunResultModel = z.object({
  route: z.enum(["clarify", "direct", "agent"]),
  runCorsairAgent: z.boolean(),
  assistantMessage: z.string().optional(),
  enhancedPrompt: z.string(),
  retrieved: z.array(retrievedChunkModel),
  longTermMemories: z.array(longTermMemoryModel).default([]),
  history: z.array(threadContextMessageModel),
  meta: ragRunMetaModel,
});

export type RagRunResultModelType = z.infer<typeof ragRunResultModel>;
