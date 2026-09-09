import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import mammoth from "mammoth";
import type { FileExtractResultModelType } from "./model";
import { badRequest } from "./error";
import { normalizeExtractedText } from "./detect";

const execFileAsync = promisify(execFile);

const LIBREOFFICE_BINARIES = ["libreoffice", "soffice"];

async function convertDocWithLibreOffice(buffer: Buffer, filename: string): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "file-extract-doc-"));
  const inputName = filename.toLowerCase().endsWith(".doc") ? filename : "input.doc";
  const inputPath = join(dir, inputName);

  try {
    await writeFile(inputPath, buffer);

    let lastError: unknown;
    for (const binary of LIBREOFFICE_BINARIES) {
      try {
        await execFileAsync(binary, [
          "--headless",
          "--convert-to",
          "docx",
          "--outdir",
          dir,
          inputPath,
        ]);
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      throw badRequest(
        "Legacy .doc files require LibreOffice (libreoffice/soffice) for local conversion. Install it or convert to .docx first.",
      );
    }

    const outputPath = join(dir, `${inputName.replace(/\.doc$/i, "")}.docx`);
    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function extractDocxText(buffer: Buffer): Promise<FileExtractResultModelType> {
  const result = await mammoth.extractRawText({ buffer });

  return {
    text: normalizeExtractedText(result.value),
    format: "docx",
    method: "mammoth",
    usedOcrFallback: false,
    lowConfidence: false,
    warnings: result.messages.map((message) => message.message),
  };
}

export async function extractDocText(
  buffer: Buffer,
  filename?: string,
): Promise<FileExtractResultModelType> {
  const docxBuffer = await convertDocWithLibreOffice(buffer, filename ?? "input.doc");
  const result = await extractDocxText(docxBuffer);

  return {
    ...result,
    format: "doc",
    method: "libreoffice",
    warnings: [
      "Converted legacy .doc to .docx locally via LibreOffice before text extraction.",
      ...result.warnings,
    ],
  };
}
