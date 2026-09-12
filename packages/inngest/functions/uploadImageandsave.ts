import path from "node:path";
import FileSaveService from "@repo/filesavemodule";
import { env as fileSaveEnv } from "@repo/filesavemodule/env";
import ChatService from "@repo/chat";
import { logger } from "@repo/logger";
import { inngest } from "../client";
import {
  UPLOAD_IMAGE_AND_SAVE_EVENT,
  uploadImageAndSaveInputModel,
  uploadImageAndSaveOutputModel,
} from "./uploadImageandsave.model";

const fileSaveService = new FileSaveService();
const chatService = new ChatService();

function isR2Configured(): boolean {
  return Boolean(
    fileSaveEnv.R2_ACCOUNT_ID &&
      fileSaveEnv.R2_BUCKET &&
      fileSaveEnv.R2_ACCESS_KEY_ID &&
      fileSaveEnv.R2_SECRET_ACCESS_KEY,
  );
}

function isS3Configured(): boolean {
  return Boolean(
    fileSaveEnv.AWS_S3_BUCKET &&
      fileSaveEnv.AWS_REGION &&
      fileSaveEnv.AWS_ACCESS_KEY_ID &&
      fileSaveEnv.AWS_SECRET_ACCESS_KEY,
  );
}

function resolveStorageProvider(): "r2" | "s3" {
  if (isR2Configured()) return "r2";
  if (isS3Configured()) return "s3";
  throw new Error(
    "No file storage provider configured. Set R2_* or AWS_S3_* environment variables.",
  );
}

function sanitizeFilename(filename: string): string {
  const base = path.basename(filename).replace(/[^\w.\-()+]/g, "_");
  return base.length > 0 ? base : "attachment";
}

export function buildObjectKey(
  userId: string,
  messageId: string,
  filename: string,
  attachmentIndex = 0,
): string {
  return `chat/${userId}/${messageId}/${attachmentIndex}-${sanitizeFilename(filename)}`;
}

export const uploadImageAndSave = inngest.createFunction(
  {
    id: "upload-image-and-save",
    name: "Upload chat attachment and save image URL on message",
    triggers: [{ event: UPLOAD_IMAGE_AND_SAVE_EVENT }],
  },
  async ({ event, step }) => {
    const input = uploadImageAndSaveInputModel.parse(event.data);
    const provider = resolveStorageProvider();
    const key = buildObjectKey(
      input.userId,
      input.messageId,
      input.filename,
      input.attachmentIndex,
    );

    const upload = await step.run("upload-file", async () => {
      const body = Buffer.from(input.data, "base64");
      if (body.length === 0) {
        throw new Error("Attached file is empty.");
      }

      logger.info("Uploading chat attachment to object storage", {
        userId: input.userId,
        messageId: input.messageId,
        filename: input.filename,
        provider,
        key,
        bytes: body.length,
      });

      const uploadInput = {
        key,
        body,
        contentType: input.mimeType ?? "application/octet-stream",
        metadata: {
          userId: input.userId,
          messageId: input.messageId,
          filename: input.filename,
        },
      };

      return provider === "r2"
        ? fileSaveService.uploadToR2(uploadInput)
        : fileSaveService.uploadToS3(uploadInput);
    });

    await step.sleep("wait-before-image-url-update", "30s");

    await step.run("append-message-image-url", async () => {
      logger.info("Appending chat message attachment URL", {
        userId: input.userId,
        messageId: input.messageId,
        imageUrl: upload.url,
      });

      await chatService.appendMessageImageUrl({
        userId: input.userId,
        messageId: input.messageId,
        imageUrl: upload.url,
      });
    });

    return uploadImageAndSaveOutputModel.parse({
      imageUrl: upload.url,
      provider: upload.provider,
      key: upload.key,
    });
  },
);

export default uploadImageAndSave;
