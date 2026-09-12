import path from "node:path";
import { randomUUID } from "node:crypto";
import type { GmailAttachmentRef } from "@repo/database/schema";
import FileSaveService from "@repo/filesavemodule";
import { env as fileSaveEnv } from "@repo/filesavemodule/env";
import { badRequest } from "@repo/error";
import type { GmailAttachmentRefModelType } from "./model";

const fileSaveService = new FileSaveService();

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_ATTACHMENT_BYTES = 25 * 1024 * 1024;

const ACCEPTED_EXTENSIONS = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "doc",
  "docx",
  "xlsx",
  "xls",
  "csv",
]);

function isR2Configured(): boolean {
  return Boolean(
    fileSaveEnv.R2_ACCOUNT_ID &&
      fileSaveEnv.R2_BUCKET &&
      fileSaveEnv.R2_ACCESS_KEY_ID &&
      fileSaveEnv.R2_SECRET_ACCESS_KEY,
  );
}

function isS3Configured(): boolean {
  return Boolean(
    fileSaveEnv.AWS_S3_BUCKET &&
      fileSaveEnv.AWS_REGION &&
      fileSaveEnv.AWS_ACCESS_KEY_ID &&
      fileSaveEnv.AWS_SECRET_ACCESS_KEY,
  );
}

export function isAttachmentStorageConfigured(): boolean {
  return isR2Configured() || isS3Configured();
}

function resolveStorageProvider(): "r2" | "s3" {
  if (isR2Configured()) return "r2";
  if (isS3Configured()) return "s3";
  throw badRequest(
    "File storage is not configured. Set AWS_S3_* or R2_* environment variables to attach files.",
  );
}

function sanitizeFilename(filename: string): string {
  const base = path.basename(filename).replace(/[^\w.\-()+]/g, "_");
  return base.length > 0 ? base : "attachment";
}

function extensionFromFilename(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  return ext ?? null;
}

export function assertSupportedAttachmentFilename(filename: string): void {
  const ext = extensionFromFilename(filename);
  if (!ext || !ACCEPTED_EXTENSIONS.has(ext)) {
    throw badRequest("Unsupported file type. Use pdf, png, jpg, doc, docx, xlsx, xls, or csv.");
  }
}

export function buildApprovalAttachmentKey(
  userId: string,
  approvalId: string,
  attachmentId: string,
  filename: string,
): string {
  return `approvals/${userId}/${approvalId}/${attachmentId}/${sanitizeFilename(filename)}`;
}

export function normalizeAttachments(parameters: Record<string, unknown>): GmailAttachmentRef[] {
  const raw = parameters.attachments;
  if (!Array.isArray(raw)) return [];

  const out: GmailAttachmentRef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as GmailAttachmentRef;
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

export function totalAttachmentBytes(attachments: GmailAttachmentRef[]): number {
  return attachments.reduce((sum, item) => sum + item.size, 0);
}

export function assertAttachmentSizeLimits(
  attachments: GmailAttachmentRef[],
  incomingBytes = 0,
): void {
  const total = totalAttachmentBytes(attachments) + incomingBytes;
  if (total > MAX_TOTAL_ATTACHMENT_BYTES) {
    throw badRequest(
      `Total attachment size exceeds ${MAX_TOTAL_ATTACHMENT_BYTES / (1024 * 1024)}MB Gmail limit.`,
    );
  }
}

export function mergeAttachmentEdits(
  existing: GmailAttachmentRef[],
  draft: {
    attachments?: GmailAttachmentRefModelType[];
    removeAttachmentIds?: string[];
  },
): GmailAttachmentRef[] {
  let next = [...existing];

  if (draft.removeAttachmentIds?.length) {
    const remove = new Set(draft.removeAttachmentIds);
    next = next.filter((item) => !remove.has(item.id));
  }

  if (draft.attachments?.length) {
    const byId = new Map(next.map((item) => [item.id, item]));
    for (const item of draft.attachments) {
      byId.set(item.id, item);
    }
    next = [...byId.values()];
  }

  assertAttachmentSizeLimits(next);
  return next;
}

async function uploadBytes(input: {
  key: string;
  body: Buffer;
  contentType: string;
  metadata: Record<string, string>;
}): Promise<{ storageKey: string; url?: string }> {
  const provider = resolveStorageProvider();
  const uploadInput = {
    key: input.key,
    body: input.body,
    contentType: input.contentType,
    metadata: input.metadata,
  };

  const result =
    provider === "r2"
      ? await fileSaveService.uploadToR2(uploadInput)
      : await fileSaveService.uploadToS3(uploadInput);

  return { storageKey: result.key, url: result.url };
}

export async function uploadApprovalAttachment(input: {
  userId: string;
  approvalId: string;
  filename: string;
  mimeType?: string;
  body: Buffer;
}): Promise<GmailAttachmentRef> {
  if (input.body.length === 0) throw badRequest("Attached file is empty.");
  if (input.body.length > MAX_ATTACHMENT_BYTES) {
    throw badRequest(`File too large (max ${MAX_ATTACHMENT_BYTES / (1024 * 1024)}MB).`);
  }

  assertSupportedAttachmentFilename(input.filename);

  const id = randomUUID();
  const storageKey = buildApprovalAttachmentKey(input.userId, input.approvalId, id, input.filename);
  const mimeType = input.mimeType?.trim() || "application/octet-stream";

  const uploaded = await uploadBytes({
    key: storageKey,
    body: input.body,
    contentType: mimeType,
    metadata: {
      userId: input.userId,
      approvalId: input.approvalId,
      attachmentId: id,
      filename: sanitizeFilename(input.filename),
    },
  });

  return {
    id,
    filename: sanitizeFilename(input.filename),
    mimeType,
    size: input.body.length,
    storageKey: uploaded.storageKey,
    url: uploaded.url,
  };
}

export async function copyAttachmentToApproval(input: {
  userId: string;
  approvalId: string;
  source: GmailAttachmentRef;
}): Promise<GmailAttachmentRef> {
  const body = await fileSaveService.getObject(input.source.storageKey);
  return uploadApprovalAttachment({
    userId: input.userId,
    approvalId: input.approvalId,
    filename: input.source.filename,
    mimeType: input.source.mimeType,
    body,
  });
}

export async function downloadAttachmentsForSend(
  attachments: GmailAttachmentRef[],
): Promise<Array<{ filename: string; mimeType: string; content: Buffer }>> {
  if (attachments.length === 0) return [];

  const out: Array<{ filename: string; mimeType: string; content: Buffer }> = [];
  for (const attachment of attachments) {
    const content = await fileSaveService.getObject(attachment.storageKey);
    out.push({
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      content,
    });
  }
  return out;
}

export async function uploadChatFileToApproval(input: {
  userId: string;
  approvalId: string;
  filename: string;
  mimeType?: string;
  body: Buffer;
}): Promise<GmailAttachmentRef> {
  return uploadApprovalAttachment(input);
}
