import type { SupportedFileFormatModelType } from "./model";
import type { FileExtractInputModelType, FileExtractResultModelType } from "./model";
import { looksGarbled } from "./detect";
import { runOcr } from "./ocr";

export async function extractImageText(
  buffer: Buffer,
  format: Extract<SupportedFileFormatModelType, "png" | "jpg" | "jpeg">,
  input: Pick<FileExtractInputModelType, "minOcrConfidence" | "ocrLanguage">,
): Promise<FileExtractResultModelType> {
  const ocr = await runOcr(buffer, input.ocrLanguage);

  return {
    text: ocr.text,
    format,
    method: "tesseract",
    confidence: ocr.confidence,
    usedOcrFallback: false,
    lowConfidence: ocr.confidence < input.minOcrConfidence || looksGarbled(ocr.text),
    warnings: [],
  };
}
