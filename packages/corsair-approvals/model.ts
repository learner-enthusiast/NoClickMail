import { z } from "zod";
import {
  corsairEventRiskLevelValues,
  corsairEventServiceValues,
  corsairEventStatusValues,
} from "@repo/database/schema";

export const corsairApprovalModel = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  service: z.enum(corsairEventServiceValues),
  action: z.string(),
  status: z.enum(corsairEventStatusValues),
  riskLevel: z.enum(corsairEventRiskLevelValues),
  title: z.string(),
  description: z.string(),
  parameters: z.record(z.string(), z.unknown()),
  requiresApproval: z.boolean(),
  expiresAt: z.string(),
  approvedAt: z.string().nullable(),
  executedAt: z.string().nullable(),
  result: z.unknown().nullable(),
  error: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CorsairApprovalModelType = z.infer<typeof corsairApprovalModel>;

/** Shared pagination input for corsair approval list routes. */
export const corsairApprovalListPaginationInputModel = z.object({
  page: z.number().int().min(1).default(1).describe("1-based page number"),
  pageSize: z.number().int().min(1).max(100).default(20).describe("Items per page"),
});

export type CorsairApprovalListPaginationInputModelType = z.infer<
  typeof corsairApprovalListPaginationInputModel
>;

/** Shared pagination metadata returned with list routes. */
export const corsairApprovalPaginationMetaModel = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

export type CorsairApprovalPaginationMetaModelType = z.infer<
  typeof corsairApprovalPaginationMetaModel
>;

/** Paginated list of corsair approval events. */
export const corsairApprovalPaginatedListOutputModel = z.object({
  items: z.array(corsairApprovalModel),
  pagination: corsairApprovalPaginationMetaModel,
});

export type CorsairApprovalPaginatedListOutputModelType = z.infer<
  typeof corsairApprovalPaginatedListOutputModel
>;

export const corsairApprovalStreamDeltaEventModel = z.object({
  type: z.literal("delta"),
  text: z.string(),
});

export const corsairApprovalStreamDoneEventModel = z.object({
  type: z.literal("done"),
  approvalId: z.uuid(),
  threadId: z.uuid(),
  output: z.string(),
});

export const corsairApprovalStreamEventModel = z.discriminatedUnion("type", [
  corsairApprovalStreamDeltaEventModel,
  corsairApprovalStreamDoneEventModel,
]);

export type CorsairApprovalStreamEventModelType = z.infer<
  typeof corsairApprovalStreamEventModel
>;

/** Gmail attachment metadata stored on approval parameters (bytes live in object storage). */
export const gmailAttachmentRefModel = z.object({
  id: z.uuid(),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().positive(),
  storageKey: z.string().min(1),
  url: z.string().url().optional(),
});

export type GmailAttachmentRefModelType = z.infer<typeof gmailAttachmentRefModel>;

/** Optional email draft edits applied when approving a pending Gmail send. */
export const corsairApprovalDraftEditModel = z.object({
  to: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  attachments: z.array(gmailAttachmentRefModel).optional(),
  removeAttachmentIds: z.array(z.uuid()).optional(),
});

export type CorsairApprovalDraftEditModelType = z.infer<typeof corsairApprovalDraftEditModel>;

export const corsairApprovalApproveInputModel = z.object({
  approvalId: z.uuid(),
  draft: corsairApprovalDraftEditModel.optional(),
});

export type CorsairApprovalApproveInputModelType = z.infer<
  typeof corsairApprovalApproveInputModel
>;

export const corsairApprovalUpdateDraftInputModel = z.object({
  approvalId: z.uuid(),
  draft: corsairApprovalDraftEditModel,
});

export type CorsairApprovalUpdateDraftInputModelType = z.infer<
  typeof corsairApprovalUpdateDraftInputModel
>;

export const corsairApprovalUploadAttachmentInputModel = z.object({
  approvalId: z.uuid(),
  filename: z.string().min(1),
  mimeType: z.string().min(1).optional(),
  data: z.string().min(1).describe("Base64-encoded file bytes"),
  size: z.number().int().positive().optional(),
});

export type CorsairApprovalUploadAttachmentInputModelType = z.infer<
  typeof corsairApprovalUploadAttachmentInputModel
>;
