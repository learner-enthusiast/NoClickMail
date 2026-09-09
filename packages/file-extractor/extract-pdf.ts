import { extractText, getDocumentProxy } from "unpdf";
import type { FileExtractInputModelType, FileExtractResultModelType } from "./model";
import { looksGarbled, normalizeExtractedText } from "./detect";
import { runOcr } from "./ocr";

export async function extractPdfText(
  buffer: Buffer,
  input: Pick<FileExtractInputModelType, "filename" | "ocrLanguage" | "minOcrConfidence" | "pdfTextFallbackThreshold">,
): Promise<FileExtractResultModelType> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  const extracted = normalizeExtractedText(Array.isArray(text) ? text.join("\n\n") : text);

  const needsOcr =
    extracted.length < input.pdfTextFallbackThreshold || looksGarbled(extracted);

  if (!needsOcr) {
    return {
      text: extracted,
      format: "pdf",
      method: "unpdf",
      pageCount: totalPages,
      usedOcrFallback: false,
      lowConfidence: false,
      warnings: [],
    };
  }

  const ocr = await runOcr(buffer, input.ocrLanguage, {
    pdfTitle: input.filename ?? "document.pdf",
  });

  const warnings =
    extracted.length > 0
      ? ["PDF text layer was sparse or garbled; OCR fallback was used."]
      : ["PDF appears scanned; OCR was used instead of text extraction."];

  return {
    text: ocr.text,
    format: "pdf",
    method: "tesseract",
    confidence: ocr.confidence,
    pageCount: totalPages,
    usedOcrFallback: true,
    lowConfidence: ocr.confidence < input.minOcrConfidence || looksGarbled(ocr.text),
    warnings,
  };
}
