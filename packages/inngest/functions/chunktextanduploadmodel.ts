import { z } from "zod";

export const CHUNK_TEXT_AND_UPLOAD_EVENT = "rag/chunk-text-and-upload" as const;

export const chunkTextAndUploadInputModel = z.object({
  userId: z.uuid(),
  threadId: z.uuid(),
  messageId: z.uuid(),
  role: z.enum(["user", "assistant", "system"]).default("user"),
  /** Inline extracted text — used in dev; omitted in prod (resolved from message imageUrl). */
  text: z.string().min(1).optional(),
  sourceFilename: z.string().min(1).optional(),
  /** Position of this file within the message's attachments — namespaces its vector ids. */
  attachmentIndex: z.number().int().nonnegative().default(0),
});

export type ChunkTextAndUploadInputModelType = z.infer<typeof chunkTextAndUploadInputModel>;

export const chunkTextAndUploadOutputModel = z.object({
  chunkCount: z.number().int().nonnegative(),
  embeddedCount: z.number().int().nonnegative(),
});

export type ChunkTextAndUploadOutputModelType = z.infer<typeof chunkTextAndUploadOutputModel>;

export const chunkTextAndUploadEventModel = z.object({
  name: z.literal(CHUNK_TEXT_AND_UPLOAD_EVENT),
  data: chunkTextAndUploadInputModel,
});

export type ChunkTextAndUploadEventModelType = z.infer<typeof chunkTextAndUploadEventModel>;
