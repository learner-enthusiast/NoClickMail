import * as XLSX from "xlsx";
import type { SupportedFileFormatModelType } from "./model";
import type { FileExtractResultModelType } from "./model";
import { normalizeExtractedText } from "./detect";

function sheetToText(sheet: XLSX.WorkSheet): string {
  return XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
}

export function extractSpreadsheetText(
  buffer: Buffer,
  format: Extract<SupportedFileFormatModelType, "xlsx" | "xls" | "csv">,
): FileExtractResultModelType {
  if (format === "csv") {
    return {
      text: normalizeExtractedText(buffer.toString("utf8")),
      format: "csv",
      method: "xlsx",
      usedOcrFallback: false,
      lowConfidence: false,
      warnings: [],
    };
  }

  const workbook = XLSX.read(buffer, { type: "buffer" });
  const parts = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    if (!sheet) return "";
    return `# Sheet: ${name}\n${sheetToText(sheet)}`.trim();
  }).filter(Boolean);

  return {
    text: normalizeExtractedText(parts.join("\n\n")),
    format,
    method: "xlsx",
    usedOcrFallback: false,
    lowConfidence: false,
    warnings: [],
  };
}
