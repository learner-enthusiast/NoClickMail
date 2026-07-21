import { z } from "zod";
import { ragRunMetaModel } from "@repo/services/rag/model";

export const agentStreamMetaEventModel = z.object({
  type: z.literal("meta"),
  threadId: z.string().uuid(),
  rag: ragRunMetaModel,
});

export const agentStreamDeltaEventModel = z.object({
  type: z.literal("delta"),
  text: z.string(),
});

export const agentStreamDoneEventModel = z.object({
  type: z.literal("done"),
  threadId: z.string().uuid(),
  output: z.string(),
  rag: ragRunMetaModel,
});

export const agentStreamEventModel = z.discriminatedUnion("type", [
  agentStreamMetaEventModel,
  agentStreamDeltaEventModel,
  agentStreamDoneEventModel,
]);

export type AgentStreamEventModelType = z.infer<typeof agentStreamEventModel>;
