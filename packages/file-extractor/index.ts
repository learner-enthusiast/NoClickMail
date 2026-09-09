import { badRequest, normalizeFileExtractError } from "./error";
import { detectFileFormat, toBuffer } from "./detect";
import { extractImageText } from "./extract-image";
import { extractDocText, extractDocxText } from "./extract-office";
import { extractPdfText } from "./extract-pdf";
import { extractSpreadsheetText } from "./extract-spreadsheet";
import { terminateOcrWorker } from "./ocr";
import {
  fileExtractInputModel,
  fileExtractResultModel,
  type FileExtractInputModelType,
  type FileExtractResultModelType,
} from "./model";

export type { FileExtractInputModelType, FileExtractResultModelType } from "./model";
export type { SupportedFileFormatModelType, ExtractionMethodModelType } from "./model";
export {
  fileExtractInputModel,
  fileExtractResultModel,
  supportedFileFormatModel,
  extractionMethodModel,
} from "./model";

class FileExtractorService {
  async extractText(input: FileExtractInputModelType): Promise<FileExtractResultModelType> {
    const parsed = fileExtractInputModel.parse(input);
    const buffer = toBuffer(parsed.file);
    const format = detectFileFormat(buffer, parsed.filename, parsed.mimeType);

    try {
      let result: FileExtractResultModelType;

      switch (format) {
        case "pdf":
          result = await extractPdfText(buffer, parsed);
          break;
        case "png":
        case "jpg":
        case "jpeg":
          result = await extractImageText(buffer, format, parsed);
          break;
        case "docx":
          result = await extractDocxText(buffer);
          break;
        case "doc":
          result = await extractDocText(buffer, parsed.filename);
          break;
        case "xlsx":
        case "xls":
        case "csv":
          result = extractSpreadsheetText(buffer, format);
          break;
        default:
          throw badRequest(`Unsupported file format: ${format satisfies never}`);
      }

      return fileExtractResultModel.parse(result);
    } catch (error) {
      throw normalizeFileExtractError(error);
    }
  }

  /** Release the shared Tesseract worker when shutting down the process. */
  async dispose(): Promise<void> {
    await terminateOcrWorker();
  }
}

export default FileExtractorService;
