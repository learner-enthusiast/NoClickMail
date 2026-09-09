import { z } from "zod";

const fileBodyModel = z.union([z.instanceof(Buffer), z.instanceof(Uint8Array)]);

export const supportedFileFormatModel = z.enum([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "doc",
  "docx",
  "xlsx",
  "xls",
  "csv",
]);

export type SupportedFileFormatModelType = z.infer<typeof supportedFileFormatModel>;

export const extractionMethodModel = z.enum(["unpdf", "tesseract", "mammoth", "xlsx", "libreoffice"]);

export type ExtractionMethodModelType = z.infer<typeof extractionMethodModel>;

export const fileExtractInputModel = z.object({
  file: fileBodyModel,
  filename: z.string().min(1).optional(),
  mimeType: z.string().min(1).optional(),
  /** Tesseract language code, e.g. eng */
  ocrLanguage: z.string().min(2).default("eng"),
  /** Flag OCR output below this confidence (0–100) as lowConfidence */
  minOcrConfidence: z.number().min(0).max(100).default(60),
  /** PDF: fall back to OCR when unpdf text is shorter than this */
  pdfTextFallbackThreshold: z.number().int().nonnegative().default(32),
});

export type FileExtractInputModelType = z.infer<typeof fileExtractInputModel>;

export const fileExtractResultModel = z.object({
  text: z.string(),
  format: supportedFileFormatModel,
  method: extractionMethodModel,
  confidence: z.number().min(0).max(100).optional(),
  pageCount: z.number().int().positive().optional(),
  usedOcrFallback: z.boolean().default(false),
  lowConfidence: z.boolean().default(false),
  warnings: z.array(z.string()).default([]),
});

export type FileExtractResultModelType = z.infer<typeof fileExtractResultModel>;
