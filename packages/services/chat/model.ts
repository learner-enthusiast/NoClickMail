import { z } from "zod";

export const chatRoleModel = z.enum(["user", "assistant", "system"]);

export const chatMessageModel = z.object({
  id: z.string(),
  threadId: z.string(),
  role: chatRoleModel,
  content: z.string(),
  createdAt: z.string(),
});
export type ChatMessageType = z.infer<typeof chatMessageModel>;

export const chatThreadModel = z.object({
  id: z.string(),
  title: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ChatThreadType = z.infer<typeof chatThreadModel>;
