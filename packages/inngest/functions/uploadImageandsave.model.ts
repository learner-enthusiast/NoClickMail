import { z } from "zod";

export const UPLOAD_IMAGE_AND_SAVE_EVENT = "chat/upload-image-and-save" as const;

export const uploadImageAndSaveInputModel = z.object({
  userId: z.uuid(),
  messageId: z.uuid(),
  filename: z.string().min(1),
  mimeType: z.string().min(1).optional(),
  /** Base64-encoded file bytes */
  data: z.string().min(1),
});

export type UploadImageAndSaveInputModelType = z.infer<typeof uploadImageAndSaveInputModel>;

export const uploadImageAndSaveOutputModel = z.object({
  imageUrl: z.url(),
  provider: z.enum(["s3", "r2"]),
  key: z.string().min(1),
});

export type UploadImageAndSaveOutputModelType = z.infer<typeof uploadImageAndSaveOutputModel>;

export const uploadImageAndSaveEventModel = z.object({
  name: z.literal(UPLOAD_IMAGE_AND_SAVE_EVENT),
  data: uploadImageAndSaveInputModel,
});

export type UploadImageAndSaveEventModelType = z.infer<typeof uploadImageAndSaveEventModel>;
