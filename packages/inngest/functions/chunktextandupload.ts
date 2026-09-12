import RagService from "@repo/rag";
import FileSaveService from "@repo/filesavemodule";
import FileExtractorService from "@repo/file-extractor";
import { env } from "@repo/env";
import { logger } from "@repo/logger";
import { inngest } from "../client";
import {
  CHUNK_TEXT_AND_UPLOAD_EVENT,
  chunkTextAndUploadInputModel,
  chunkTextAndUploadOutputModel,
} from "./chunktextanduploadmodel";
import { buildObjectKey } from "./uploadImageandsave";

const ragService = new RagService();
const fileSaveService = new FileSaveService();
const fileExtractorService = new FileExtractorService();

function isProduction(): boolean {
  return env.NODE_ENV === "production" || env.NODE_ENV === "prod";
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

      // Read this attachment back by its deterministic object key rather than the
      // message's single imageUrl, so every file of a multi-file message resolves.
      text = await step.run("fetch-and-extract-from-storage", async () => {
        const filename = input.sourceFilename ?? "attachment";
        const key = buildObjectKey(
          input.userId,
          input.messageId,
          filename,
          input.attachmentIndex,
        );

        const buffer = await fileSaveService.getObject(key);
        const extraction = await fileExtractorService.extractText({
          file: buffer,
          filename,
          ocrLanguage: "eng",
          minOcrConfidence: 60,
          pdfTextFallbackThreshold: 32,
        });

        logger.info("Extracted attachment text from object storage for pgvector indexing", {
          userId: input.userId,
          messageId: input.messageId,
          key,
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
        attachmentIndex: input.attachmentIndex,
        textLength: text.length,
        production: isProduction(),
      });

      return ragService.indexTextForRetrieval({
        userId: input.userId,
        threadId: input.threadId,
        messageId: input.messageId,
        role: input.role,
        text,
        sourceIndex: input.attachmentIndex,
      });
    });

    return chunkTextAndUploadOutputModel.parse(result);
  },
);

export default chunkTextAndUpload;
