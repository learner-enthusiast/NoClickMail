import type { RetrievedChunkModelType } from "@repo/rag-models/retrieve.model";

export type PriorTurnModel = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type AgentRagContext = {
  enhancedPrompt: string;
  retrieved: RetrievedChunkModelType[];
};
