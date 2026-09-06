import { z } from "zod";
import { ragRunMetaModel } from "@repo/services/rag/model";

export const agentStreamMetaEventModel = z.object({
  type: z.literal("meta"),
  threadId: z.string().uuid(),
  rag: ragRunMetaModel,
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
