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

export interface GmailCorsairParameters {
  messageId?: string;
  threadId?: string;
  query?: string;

  to?: string[];
  cc?: string[];
  bcc?: string[];

  subject?: string;
  body?: string;

  inReplyTo?: string;

  forwardMessageId?: string;

  addLabels?: string[];
  removeLabels?: string[];
}
