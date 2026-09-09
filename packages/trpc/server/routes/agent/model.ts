import { z } from "zod";
import { ragRunMetaModel, supportedFileFormatModel, extractionMethodModel } from "@repo/services/model";

export const runAgentFileInputModel = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1).optional(),
  /** Base64-encoded file bytes */
  data: z.string().min(1),
  size: z.number().int().positive().optional(),
});

export type RunAgentFileInputModelType = z.infer<typeof runAgentFileInputModel>;

export const runAgentInputModel = z
  .object({
    prompt: z.string(),
    threadId: z.uuid().optional(),
    file: runAgentFileInputModel.optional(),
  })
  .refine((input) => input.prompt.trim().length > 0 || input.file, {
    message: "Provide a message or attach a file.",
  });

export type RunAgentInputModelType = z.infer<typeof runAgentInputModel>;

export const agentStreamMetaEventModel = z.object({
  type: z.literal("meta"),
  threadId: z.string().uuid(),
  rag: ragRunMetaModel,
  file: z
    .object({
      filename: z.string(),
      format: supportedFileFormatModel,
      method: extractionMethodModel,
      lowConfidence: z.boolean(),
    })
    .optional(),
});

export const agentStreamApprovalCreatedEventModel = z.object({
  type: z.literal("approval_created"),
  approvalId: z.string().uuid(),
});

export const agentStreamDeltaEventModel = z.object({
  type: z.literal("delta"),
  text: z.string(),
});

export const agentStreamDoneEventModel = z.object({
  type: z.literal("done"),
  threadId: z.string().uuid(),
  messageId: z.string().uuid().optional(),
  output: z.string(),
  rag: ragRunMetaModel,
  approvalId: z.string().uuid().optional(),
});

export const agentStreamEventModel = z.discriminatedUnion("type", [
  agentStreamMetaEventModel,
  agentStreamApprovalCreatedEventModel,
  agentStreamDeltaEventModel,
  agentStreamDoneEventModel,
]);

export type AgentStreamEventModelType = z.infer<typeof agentStreamEventModel>;
