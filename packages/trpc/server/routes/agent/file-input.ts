import { TRPCError } from "@trpc/server";
import type {
  ExtractionMethodModelType,
  FileExtractResultModelType,
  SupportedFileFormatModelType,
} from "@repo/services/model";
import type { RunAgentFileInputModelType } from "./model";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_FILE_BYTES = 20 * 1024 * 1024;

export type ExtractedAttachment = {
  filename: string;
  mimeType?: string;
  extraction: FileExtractResultModelType;
};

export type AttachmentMeta = {
  filename: string;
  format: SupportedFileFormatModelType;
  method: ExtractionMethodModelType;
  lowConfidence: boolean;
};

export function decodeRunAgentFile(file: RunAgentFileInputModelType): Buffer {
  let buffer: Buffer;
  try {
    buffer = Buffer.from(file.data, "base64");
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid file encoding." });
  }

  if (buffer.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Attached file is empty: ${file.filename}`,
    });
  }

  if (file.size && file.size !== buffer.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `File size mismatch: ${file.filename}`,
    });
  }

  if (buffer.length > MAX_FILE_BYTES) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `File too large (max ${MAX_FILE_BYTES / (1024 * 1024)}MB): ${file.filename}`,
    });
  }

  return buffer;
}

/** Decode every attachment up front so an invalid file fails before any extraction work. */
export function decodeRunAgentFiles(files: RunAgentFileInputModelType[]): Buffer[] {
  const buffers = files.map((file) => decodeRunAgentFile(file));
  const total = buffers.reduce((sum, buffer) => sum + buffer.length, 0);

  if (total > MAX_TOTAL_FILE_BYTES) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Attachments are too large together (max ${MAX_TOTAL_FILE_BYTES / (1024 * 1024)}MB total).`,
    });
  }

  return buffers;
}

function attachmentSection(attachment: ExtractedAttachment): string {
  const { filename, extraction } = attachment;
  const warnings =
    extraction.warnings.length > 0
      ? `\nExtraction notes:\n- ${extraction.warnings.join("\n- ")}`
      : "";
  const confidenceNote = extraction.lowConfidence
    ? "\nNote: OCR confidence was low; extracted text may be incomplete."
    : "";

  return [
    `--- Attached file: ${filename} (${extraction.format}, ${extraction.method}) ---`,
    extraction.text,
    warnings,
    confidenceNote,
    `--- End attached file: ${filename} ---`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Build the agent prompt from every attachment, keeping each file in its own
 * labelled block so mixed formats stay attributable to their source file.
 */
export function buildAgentPromptFromFiles(
  prompt: string,
  attachments: ExtractedAttachment[],
): string {
  const trimmedPrompt = prompt.trim();
  if (attachments.length === 0) return trimmedPrompt;

  const header =
    trimmedPrompt ||
    (attachments.length === 1
      ? "Please analyze the attached document."
      : `Please analyze the ${attachments.length} attached documents.`);

  return [header, "", ...attachments.map(attachmentSection)].join("\n");
}

export function userMessageContentWithAttachments(prompt: string, filenames: string[]): string {
  const trimmedPrompt = prompt.trim();
  if (filenames.length === 0) return trimmedPrompt;

  const attachmentLines = filenames.map((filename) => `📎 ${filename}`).join("\n");
  if (!trimmedPrompt) return attachmentLines;
  return `${trimmedPrompt}\n\n${attachmentLines}`;
}
