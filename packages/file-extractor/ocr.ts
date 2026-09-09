import { createWorker, type Worker } from "tesseract.js";
import { normalizeExtractedText } from "./detect";

type OcrResult = {
  text: string;
  confidence: number;
};

let workerPromise: Promise<Worker> | null = null;
let workerLanguage = "";

async function getWorker(language: string): Promise<Worker> {
  if (!workerPromise || workerLanguage !== language) {
    if (workerPromise) {
      const existing = await workerPromise;
      await existing.terminate();
    }
    workerLanguage = language;
    workerPromise = createWorker(language);
  }
  return workerPromise;
}

export async function runOcr(
  buffer: Buffer,
  language: string,
  options?: { pdfTitle?: string },
): Promise<OcrResult> {
  const worker = await getWorker(language);
  const { data } = await worker.recognize(
    buffer,
    options?.pdfTitle ? { pdfTitle: options.pdfTitle } : {},
  );

  return {
    text: normalizeExtractedText(data.text ?? ""),
    confidence: data.confidence ?? 0,
  };
}

export async function terminateOcrWorker(): Promise<void> {
  if (!workerPromise) return;
  const worker = await workerPromise;
  await worker.terminate();
  workerPromise = null;
  workerLanguage = "";
}
