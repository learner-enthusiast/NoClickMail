export type ChatMode = "text-to-text" | "text-to-voice" | "voice-to-voice";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type ChatThread = {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
  mode: ChatMode;
};
