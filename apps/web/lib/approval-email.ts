import type { CorsairApprovalModelType, GmailAttachmentRefModelType } from "@repo/services/model";

export type EmailDraftFields = {
  to: string;
  subject: string;
  body: string;
};

type EmailApprovalLike = Pick<CorsairApprovalModelType, "service" | "action" | "parameters">;

export function isEmailApproval(approval: EmailApprovalLike): boolean {
  if (approval.service === "gmail" && approval.action === "send") return true;
  const params = approval.parameters;
  return (
    typeof params.subject === "string" ||
    typeof params.body === "string" ||
    params.to != null
  );
}

export function parseEmailDraft(parameters: Record<string, unknown>): EmailDraftFields {
  const toRaw = parameters.to;
  let to = "";
  if (Array.isArray(toRaw)) {
    to = toRaw.filter((v): v is string => typeof v === "string").join(", ");
  } else if (typeof toRaw === "string") {
    to = toRaw;
  }

  return {
    to,
    subject: typeof parameters.subject === "string" ? parameters.subject : "",
    body: typeof parameters.body === "string" ? parameters.body : "",
  };
}

export function parseAttachments(
  parameters: Record<string, unknown>,
): GmailAttachmentRefModelType[] {
  const raw = parameters.attachments;
  if (!Array.isArray(raw)) return [];

  const out: GmailAttachmentRefModelType[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as GmailAttachmentRefModelType;
    if (
      typeof candidate.id === "string" &&
      typeof candidate.filename === "string" &&
      typeof candidate.mimeType === "string" &&
      typeof candidate.size === "number" &&
      typeof candidate.storageKey === "string"
    ) {
      out.push(candidate);
    }
  }
  return out;
}

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
