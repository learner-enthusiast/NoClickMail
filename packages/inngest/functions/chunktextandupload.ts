import path from "node:path";
import RagService from "@repo/rag";
import ChatService from "@repo/chat";
import FileExtractorService from "@repo/file-extractor";
import { env } from "@repo/env";
import { logger } from "@repo/logger";
import { inngest } from "../client";
import {
  CHUNK_TEXT_AND_UPLOAD_EVENT,
  chunkTextAndUploadInputModel,
  chunkTextAndUploadOutputModel,
} from "./chunktextanduploadmodel";

const ragService = new RagService();
const chatService = new ChatService();
const fileExtractorService = new FileExtractorService();

function isProduction(): boolean {
  return env.NODE_ENV === "production" || env.NODE_ENV === "prod";
}

function filenameFromUrl(url: string, fallback?: string): string {
  try {
    const base = path.basename(new URL(url).pathname);
    if (base && base !== "/") return base;
  } catch {
    // ignore invalid URL
  }
  return fallback ?? "attachment";
}

async function fetchFileBuffer(imageUrl: string): Promise<Buffer> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch attachment (${response.status}): ${imageUrl}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export const chunkTextAndUpload = inngest.createFunction(
  {
    id: "chunk-text-and-upload",
    name: "Chunk extracted file text and upload to pgvector",
    triggers: [{ event: CHUNK_TEXT_AND_UPLOAD_EVENT }],
  },
  async ({ event, step }) => {
    const input = chunkTextAndUploadInputModel.parse(event.data);

    let text: string;

    if (isProduction()) {
      await step.sleep("wait-for-attachment-upload", "50s"); //Hope will happen in 50s or will have to implement polling

      text = await step.run("fetch-and-extract-from-image-url", async () => {
        const message = await chatService.getMessageForUser(input.userId, input.messageId);
        if (!message.imageUrl) {
          throw new Error(
            `Message ${input.messageId} has no imageUrl yet — upload may still be in progress or failed.`,
          );
        }

        const filename = filenameFromUrl(message.imageUrl, input.sourceFilename);
        const buffer = await fetchFileBuffer(message.imageUrl);
        const extraction = await fileExtractorService.extractText({
          file: buffer,
          filename,
          ocrLanguage: "eng",
          minOcrConfidence: 60,
          pdfTextFallbackThreshold: 32,
        });

        logger.info("Extracted attachment text from imageUrl for pgvector indexing", {
          userId: input.userId,
          messageId: input.messageId,
          imageUrl: message.imageUrl,
          filename,
          format: extraction.format,
          textLength: extraction.text.length,
        });

        return extraction.text;
      });
    } else {
      if (!input.text) {
        throw new Error(
          "chunk-text-and-upload requires inline text in non-production environments.",
        );
      }
      text = input.text;
    }

    const result = await step.run("chunk-embed-upload", async () => {
      logger.info("Indexing extracted file text for pgvector", {
        userId: input.userId,
        threadId: input.threadId,
        messageId: input.messageId,
        sourceFilename: input.sourceFilename,
        textLength: text.length,
        production: isProduction(),
      });

      return ragService.indexTextForRetrieval({
        userId: input.userId,
        threadId: input.threadId,
        messageId: input.messageId,
        role: input.role,
        text,
      });
    });

    return chunkTextAndUploadOutputModel.parse(result);
  },
);

export default chunkTextAndUpload;
