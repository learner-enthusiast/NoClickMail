import {
  CalendarService,
  ChatService,
  CorsairAgent,
  CorsairApprovalService,
  FileExtractorService,
  GmailService,
  presignMessageAttachmentUrls,
  RagService,
  UserService,
} from "@repo/services";

export const userService = new UserService();
export const gmailService = new GmailService();
export const calendarService = new CalendarService();
export { CorsairAgent };
export const chatService = new ChatService();
export const ragService = new RagService();
export const corsairApprovalService = new CorsairApprovalService();
export const fileExtractorService = new FileExtractorService();
export { presignMessageAttachmentUrls };
