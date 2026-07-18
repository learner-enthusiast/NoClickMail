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
  to: z.string().nullable(),
  subject: z.string().nullable(),
  date: z.string().nullable(),
  unread: z.boolean(),
  starred: z.boolean(),
  important: z.boolean(),
  draft: z.boolean(),
  sent: z.boolean(),
  inInbox: z.boolean(),
  trashed: z.boolean(),
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
// packages/services/gmail/model.ts

export const listMessagesPaginationModel = z.object({
  maxResults: z.number().int().min(1).max(100).default(20),
  pageToken: z.string().optional(),
  q: z.string().optional(),
});

// inbox — unchanged shape, same defaults

export const listSentInputModel = listMessagesPaginationModel;
export const listDraftsInputModel = listMessagesPaginationModel;

export const listMessagesOutputModel = z.object({
  messages: z.array(gmailMessageSummaryModel),
  nextPageToken: z.string().optional(),
});

export type ListSentInputModelType = z.infer<typeof listSentInputModel>;
export type ListDraftsInputModelType = z.infer<typeof listDraftsInputModel>;
export type ListMessagesPaginationModelType = z.infer<typeof listMessagesPaginationModel>;
export type ListMessagesOutputModelType = z.infer<typeof listMessagesOutputModel>;
/** Shared mutation success */
export const gmailSuccessOutputModel = z.object({
  success: z.boolean(),
});
export type GmailSuccessOutputModelType = z.infer<typeof gmailSuccessOutputModel>;

/** DELETE /gmail/message */
export const deleteMessageInputModel = z.object({
  id: z.string().describe("Gmail message id (or draft id if isDraft)"),
  permanent: z.boolean().default(false).describe("false = trash, true = delete forever"),
  isDraft: z.boolean().default(false).describe("true = use drafts.delete instead of messages.*"),
});
export type DeleteMessageInputModelType = z.infer<typeof deleteMessageInputModel>;
export const listTrashInputModel = listMessagesPaginationModel;
export type ListTrashInputModelType = z.infer<typeof listTrashInputModel>;
export const deleteMessageOutputModel = gmailSuccessOutputModel;
export type DeleteMessageOutputModelType = z.infer<typeof deleteMessageOutputModel>;

/** PATCH /gmail/message/read */
export const markMessageReadInputModel = z.object({
  id: z.string().describe("Gmail message id"),
  read: z.boolean().default(true).describe("true = mark read, false = mark unread"),
});
export type MarkMessageReadInputModelType = z.infer<typeof markMessageReadInputModel>;

export const markMessageReadOutputModel = gmailSuccessOutputModel;
export type MarkMessageReadOutputModelType = z.infer<typeof markMessageReadOutputModel>;
/** PATCH /gmail/message/restore */
export const restoreMessageInputModel = z.object({
  id: z.string().describe("Gmail message id"),
});
export type RestoreMessageInputModelType = z.infer<typeof restoreMessageInputModel>;

export const restoreMessageOutputModel = z.object({
  success: z.boolean(),
  restoredTo: z
    .enum(["inbox", "sent", "draft", "other"])
    .describe("Where Gmail put the message after restore"),
});
export type RestoreMessageOutputModelType = z.infer<typeof restoreMessageOutputModel>;
/** GET /gmail/draft */
export const getDraftInputModel = z.object({
  id: z.string().describe("Gmail draft id"),
});
export type GetDraftInputModelType = z.infer<typeof getDraftInputModel>;

export const gmailDraftDetailModel = gmailMessageDetailModel.extend({
  draftId: z.string(),
  messageId: z.string().optional(),
});
export type GmailDraftDetailType = z.infer<typeof gmailDraftDetailModel>;
/** GET /gmail/labels */
export const gmailLabelModel = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string().nullable(), // "system" | "user"
  messagesTotal: z.number().int().nullable().optional(),
  messagesUnread: z.number().int().nullable().optional(),
});
export type GmailLabelModelType = z.infer<typeof gmailLabelModel>;

export const listLabelsOutputModel = z.object({
  labels: z.array(gmailLabelModel),
});
export type ListLabelsOutputModelType = z.infer<typeof listLabelsOutputModel>;

/** GET /gmail/label/messages */
export const listByLabelInputModel = listMessagesPaginationModel.extend({
  labelId: z.string().min(1).describe("Gmail label id, e.g. INBOX or Label_12"),
});
export type ListByLabelInputModelType = z.infer<typeof listByLabelInputModel>;
export const gmailInboxCategoryModel = z.enum([
  "primary_unread",
  "promotions",
  "social",
  "updates",
  "subscriptions",
]);

export const listByCategoryInputModel = listMessagesPaginationModel.extend({
  category: gmailInboxCategoryModel,
});
export type ListByCategoryInputModelType = z.infer<typeof listByCategoryInputModel>;
