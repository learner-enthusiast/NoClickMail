import { z } from "zod";

/** GET /gmail/inbox */
export const listInboxInputModel = z.object({
  maxResults: z.number().int().min(1).max(100).default(20).describe("Page size"),
  pageToken: z.string().optional().describe("Gmail nextPageToken"),
  q: z.string().optional().describe("Gmail search query"),
});
export type ListInboxInputModelType = z.infer<typeof listInboxInputModel>;

export const gmailMessageSummaryModel = z.object({
  id: z.string(),
  threadId: z.string(),
  snippet: z.string(),
  from: z.string().nullable(),
  subject: z.string().nullable(),
  date: z.string().nullable(),
  unread: z.boolean(),
  labelIds: z.array(z.string()),
});
export type GmailMessageSummaryType = z.infer<typeof gmailMessageSummaryModel>;

export const listInboxOutputModel = z.object({
  messages: z.array(gmailMessageSummaryModel),
  nextPageToken: z.string().optional(),
});
export type ListInboxOutputModelType = z.infer<typeof listInboxOutputModel>;

/** GET /gmail/message */
export const getMessageInputModel = z.object({
  id: z.string().describe("Gmail message id"),
});
export type GetMessageInputModelType = z.infer<typeof getMessageInputModel>;

export const gmailMessageDetailModel = gmailMessageSummaryModel.extend({
  to: z.string().nullable(),
  cc: z.string().nullable(),
  bodyText: z.string().nullable(),
  bodyHtml: z.string().nullable(),
});
export type GmailMessageDetailType = z.infer<typeof gmailMessageDetailModel>;

/** POST /gmail/send */
export const sendMessageInputModel = z.object({
  to: z.string().describe("Recipient email"),
  subject: z.string().describe("Subject line"),
  body: z.string().describe("Plain-text body"),
});
export type SendMessageInputModelType = z.infer<typeof sendMessageInputModel>;

export const sendMessageOutputModel = z.object({
  id: z.string(),
  threadId: z.string(),
});
export type SendMessageOutputModelType = z.infer<typeof sendMessageOutputModel>;

/** Webhook events emitted from the Gmail Pub/Sub push */
export const gmailEventTypeModel = z.enum([
  "messageReceived",
  "messageDeleted",
  "messageLabelChanged",
]);
export const gmailEventModel = z.object({
  type: gmailEventTypeModel,
  emailAddress: z.string(),
  historyId: z.string(),
  messageId: z.string().optional(),
  labelsAdded: z.array(z.string()).optional(),
  labelsRemoved: z.array(z.string()).optional(),
});
export type GmailEventType = z.infer<typeof gmailEventModel>;
/** GET /gmail/sent-contacts — recipient suggestions from Sent mail */
export const listSentContactsInputModel = z.object({
  maxMessages: z
    .number()
    .int()
    .min(1)
    .max(500)
    .default(100)
    .describe("How many Sent messages to scan"),
  limit: z.number().int().min(1).max(50).default(10).describe("Max suggestions to return"),
  q: z.string().optional().describe("Filter by name/email substring (for autocomplete)"),
});
export type ListSentContactsInputModelType = z.infer<typeof listSentContactsInputModel>;

export const contactSuggestionModel = z.object({
  email: z.string(),
  name: z.string().nullable(),
  frequency: z.number().int().describe("How many sent messages went to this address"),
});
export type ContactSuggestionModelType = z.infer<typeof contactSuggestionModel>;

export const listSentContactsOutputModel = z.object({
  contacts: z.array(contactSuggestionModel),
});
export type ListSentContactsOutputModelType = z.infer<typeof listSentContactsOutputModel>;
