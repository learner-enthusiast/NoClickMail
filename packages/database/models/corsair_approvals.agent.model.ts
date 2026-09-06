export const corsairAgentExecuteAction = "agent_execute" as const;

export type CorsairAgentExecuteAction = typeof corsairAgentExecuteAction;

export type CorsairAgentMessageRole = "user" | "assistant" | "system";

export interface CorsairAgentExecutionParameters {
  prompt: string;
  enhancedPrompt: string;
  threadId: string;
  messageId: string;
  history: Array<{
    role: CorsairAgentMessageRole;
    content: string;
  }>;
  retrieved: Array<{
    id: string;
    score: number;
    text: string;
    threadId: string;
    messageId: string;
    role: CorsairAgentMessageRole;
    chunkIndex: number;
  }>;
}
