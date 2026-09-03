import type { RetrievedChunkModelType } from "../rag/retrieve.model";

export type PriorTurnModel = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type AgentRagContext = {
  enhancedPrompt: string;
  retrieved: RetrievedChunkModelType[];
};
