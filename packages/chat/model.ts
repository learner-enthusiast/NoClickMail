import { z } from "zod";

export const chatRoleModel = z.enum(["user", "assistant", "system"]);

export const chatMessageModel = z.object({
  id: z.string(),
  threadId: z.string(),
  role: chatRoleModel,
  content: z.string(),
  approvalId: z.string().uuid().nullable(),
  imageUrl: z.array(z.string().url()).nullable(),
  createdAt: z.string(),
});
export type ChatMessageType = z.infer<typeof chatMessageModel>;

export const CHAT_MESSAGES_PAGE_SIZE = 30;

export const threadMessagesInputModel = z.object({
  threadId: z.uuid(),
  limit: z.number().int().min(1).max(100).default(CHAT_MESSAGES_PAGE_SIZE),
  /** Oldest message id already shown — returns the next page of older messages. */
  cursor: z.string().uuid().optional(),
});

export type ThreadMessagesInputType = z.infer<typeof threadMessagesInputModel>;

export const threadMessagesPageModel = z.object({
  messages: z.array(chatMessageModel),
  nextCursor: z.string().uuid().nullable(),
});

export type ThreadMessagesPageType = z.infer<typeof threadMessagesPageModel>;

export const chatThreadModel = z.object({
  id: z.string(),
  title: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ChatThreadType = z.infer<typeof chatThreadModel>;
