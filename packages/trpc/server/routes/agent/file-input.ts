import { TRPCError } from "@trpc/server";
import type {
  ExtractionMethodModelType,
  FileExtractResultModelType,
  SupportedFileFormatModelType,
} from "@repo/services/model";
import type { RunAgentFileInputModelType } from "./model";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function decodeRunAgentFile(file: RunAgentFileInputModelType): Buffer {
  let buffer: Buffer;
  try {
    buffer = Buffer.from(file.data, "base64");
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid file encoding." });
  }

  if (buffer.length === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Attached file is empty." });
  }

  if (file.size && file.size !== buffer.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "File size mismatch." });
  }

  if (buffer.length > MAX_FILE_BYTES) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `File too large (max ${MAX_FILE_BYTES / (1024 * 1024)}MB).`,
    });
  }

  return buffer;
}

export function buildAgentPromptFromFile(
  prompt: string,
  filename: string,
  extraction: FileExtractResultModelType,
): string {
  const trimmedPrompt = prompt.trim();
  const header = trimmedPrompt || "Please analyze the attached document.";
  const warnings =
    extraction.warnings.length > 0 ? `\n\nExtraction notes:\n- ${extraction.warnings.join("\n- ")}` : "";
  const confidenceNote = extraction.lowConfidence
    ? "\n\nNote: OCR confidence was low; extracted text may be incomplete."
    : "";

  return [
    header,
    "",
    `--- Attached file: ${filename} (${extraction.format}, ${extraction.method}) ---`,
    extraction.text,
    "--- End attached file ---",
    warnings,
    confidenceNote,
  ]
    .filter(Boolean)
    .join("\n");
}

export function userMessageContentWithAttachment(prompt: string, filename: string): string {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) return `📎 ${filename}`;
  return `${trimmedPrompt}\n\n📎 ${filename}`;
}
