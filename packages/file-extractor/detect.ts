import type { SupportedFileFormatModelType } from "./model";
import { badRequest } from "./error";

const EXTENSION_MAP: Record<string, SupportedFileFormatModelType> = {
  pdf: "pdf",
  png: "png",
  jpg: "jpg",
  jpeg: "jpeg",
  doc: "doc",
  docx: "docx",
  xlsx: "xlsx",
  xls: "xls",
  csv: "csv",
};

const MIME_MAP: Record<string, SupportedFileFormatModelType> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xls",
  "text/csv": "csv",
};

function extensionFromFilename(filename: string | undefined): SupportedFileFormatModelType | null {
  if (!filename) return null;
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  return EXTENSION_MAP[ext] ?? null;
}

function formatFromMagicBytes(buffer: Buffer): SupportedFileFormatModelType | null {
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "%PDF") return "pdf";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpg";
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]))) {
    return "doc";
  }
  if (buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
    return null;
  }
  return null;
}

export function detectFileFormat(
  buffer: Buffer,
  filename?: string,
  mimeType?: string,
): SupportedFileFormatModelType {
  const fromName = extensionFromFilename(filename);
  if (fromName) return fromName;

  if (mimeType) {
    const normalized = mimeType.split(";")[0]?.trim().toLowerCase();
    const fromMime = normalized ? MIME_MAP[normalized] : undefined;
    if (fromMime) return fromMime;
  }

  const fromMagic = formatFromMagicBytes(buffer);
  if (fromMagic) return fromMagic;

  throw badRequest(
    "Unsupported or unknown file format. Supported: pdf, png, jpg, doc, docx, xlsx, xls, csv.",
  );
}

export function toBuffer(file: Buffer | Uint8Array): Buffer {
  return Buffer.isBuffer(file) ? file : Buffer.from(file);
}

export function looksGarbled(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  const alphanumeric = trimmed.replace(/[^\p{L}\p{N}]/gu, "").length;
  return alphanumeric / trimmed.length < 0.3;
}

export function normalizeExtractedText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
