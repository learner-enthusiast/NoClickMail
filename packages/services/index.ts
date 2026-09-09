export { env } from "@repo/env";

export {
  AppError,
  badRequest,
  conflict,
  googleAccessDeniedMessage,
  httpStatusFromError,
  internal,
  normalizeServiceError,
  notFound,
  tooManyRequests,
  unauthorized,
} from "@repo/error";

export { googleOAuth2Client } from "@repo/clients";

export {
  corsair,
  corsairDatabase,
  ensureOAuthAccessToken,
  getCorsairConnectionStatus,
  pool,
  withCorsairTenant,
} from "@repo/corsair";
export type { OAuthIntegrationName } from "@repo/corsair";

export { default as UserService } from "@repo/user";
export { default as GmailService } from "@repo/gmail";
export { default as CalendarService } from "@repo/calendar";
export { default as ChatService } from "@repo/chat";
export { default as RagService } from "@repo/rag";
export { default as CorsairApprovalService } from "@repo/corsair-approvals";
export { default as CorsairAgent } from "@repo/corsair-agent";
export { default as RunCorsairAgent } from "@repo/corsair-agent";
export { default as FileSaveService } from "@repo/filesavemodule";
export { default as FileExtractorService } from "@repo/file-extractor";
export {
  fileExtractInputModel,
  fileExtractResultModel,
  supportedFileFormatModel,
  extractionMethodModel,
} from "@repo/file-extractor";
export type {
  FileExtractInputModelType,
  FileExtractResultModelType,
  SupportedFileFormatModelType,
  ExtractionMethodModelType,
} from "@repo/file-extractor";

export {
  completeChat,
  createEmbedding,
  createEmbeddings,
} from "@repo/openai-client";
export type {
  ChatMessage,
  ChatRole,
  CompleteChatInput,
  StructuredOutputDto,
} from "@repo/openai-client";
export type { AgentRagContext, PriorTurnModel } from "@repo/corsair-agent";

export {
  formatApprovalCreatedMessage,
  formatApprovalExecutionForChat,
  requiresCorsairApproval,
} from "@repo/corsair-approvals";

export { verifyPubSubPush } from "@repo/webhooks/verify-pubsub";
export {
  buildCalendarChannelToken,
  verifyCalendarChannelToken,
} from "@repo/webhooks/calendar-channeel";

export { inngest, isInngestEnabled } from "@repo/inngest";
export {
  CHUNK_TEXT_AND_UPLOAD_EVENT,
  UPLOAD_IMAGE_AND_SAVE_EVENT,
  chunkTextAndUploadInputModel,
  chunkTextAndUploadOutputModel,
  uploadImageAndSaveInputModel,
  uploadImageAndSaveOutputModel,
} from "@repo/inngest";
export type {
  ChunkTextAndUploadInputModelType,
  ChunkTextAndUploadOutputModelType,
  UploadImageAndSaveInputModelType,
  UploadImageAndSaveOutputModelType,
} from "@repo/inngest";
