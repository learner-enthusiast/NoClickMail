export const gmailCorsairActionValues = [
  "agent_execute",
  "search",
  "read",
  "send",
  "reply",
  "forward",
  "create_draft",
  "update_draft",
  "delete",
  "archive",
  "modify_labels",
] as const;

export type GmailCorsairAction = (typeof gmailCorsairActionValues)[number];

export interface GmailAttachmentRef {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string;
  url?: string;
}

export interface GmailCorsairParameters {
  messageId?: string;
  threadId?: string;
  query?: string;

  to?: string[];
  cc?: string[];
  bcc?: string[];

  subject?: string;
  body?: string;

  attachments?: GmailAttachmentRef[];

  inReplyTo?: string;

  forwardMessageId?: string;

  addLabels?: string[];
  removeLabels?: string[];
}
