export { inngest, isInngestEnabled } from "./client";

import type { InngestFunction } from "inngest";
import { chunkTextAndUpload } from "./functions/chunktextandupload";
import { uploadImageAndSave } from "./functions/uploadImageandsave";

export {
  CHUNK_TEXT_AND_UPLOAD_EVENT,
  chunkTextAndUploadEventModel,
  chunkTextAndUploadInputModel,
  chunkTextAndUploadOutputModel,
} from "./functions/chunktextanduploadmodel";
export type {
  ChunkTextAndUploadEventModelType,
  ChunkTextAndUploadInputModelType,
  ChunkTextAndUploadOutputModelType,
} from "./functions/chunktextanduploadmodel";

export {
  UPLOAD_IMAGE_AND_SAVE_EVENT,
  uploadImageAndSaveEventModel,
  uploadImageAndSaveInputModel,
  uploadImageAndSaveOutputModel,
} from "./functions/uploadImageandsave.model";
export type {
  UploadImageAndSaveEventModelType,
  UploadImageAndSaveInputModelType,
  UploadImageAndSaveOutputModelType,
} from "./functions/uploadImageandsave.model";

export const inngestFunctions: InngestFunction.Any[] = [
  chunkTextAndUpload,
  uploadImageAndSave,
];
