import { z } from "zod";

const uploadBodyModel = z.union([
  z.instanceof(Buffer),
  z.string(),
  z.instanceof(Uint8Array),
]);

export const fileMetadataModel = z.record(z.string(), z.string());

/** Amazon S3 PutObject upload input */
export const s3UploadInputModel = z.object({
  key: z.string().min(1).describe("Object key/path in the bucket"),
  body: uploadBodyModel,
  contentType: z.string().min(1).optional(),
  metadata: fileMetadataModel.optional(),
  bucket: z.string().min(1).optional().describe("Defaults to AWS_S3_BUCKET"),
  region: z.string().min(1).optional().describe("Defaults to AWS_REGION"),
  accessKeyId: z.string().min(1).optional().describe("Defaults to AWS_ACCESS_KEY_ID"),
  secretAccessKey: z.string().min(1).optional().describe("Defaults to AWS_SECRET_ACCESS_KEY"),
  endpoint: z.string().url().optional().describe("Custom S3 endpoint (MinIO, LocalStack)"),
  forcePathStyle: z.boolean().optional().describe("Path-style URLs for local S3 emulators"),
  publicBaseUrl: z
    .string()
    .url()
    .optional()
    .describe("Public CDN/base URL; defaults to AWS_S3_PUBLIC_BASE_URL"),
});
export type S3UploadInputModelType = z.infer<typeof s3UploadInputModel>;

/** Cloudflare R2 PutObject upload input (S3-compatible API) */
export const r2UploadInputModel = z.object({
  key: z.string().min(1).describe("Object key/path in the bucket"),
  body: uploadBodyModel,
  contentType: z.string().min(1).optional(),
  metadata: fileMetadataModel.optional(),
  accountId: z.string().min(1).optional().describe("Defaults to R2_ACCOUNT_ID"),
  bucket: z.string().min(1).optional().describe("Defaults to R2_BUCKET"),
  accessKeyId: z.string().min(1).optional().describe("Defaults to R2_ACCESS_KEY_ID"),
  secretAccessKey: z.string().min(1).optional().describe("Defaults to R2_SECRET_ACCESS_KEY"),
  publicBaseUrl: z
    .string()
    .url()
    .optional()
    .describe("Public CDN/custom domain; defaults to R2_PUBLIC_BASE_URL"),
});
export type R2UploadInputModelType = z.infer<typeof r2UploadInputModel>;

export const fileUploadResultModel = z.object({
  provider: z.enum(["s3", "r2"]),
  bucket: z.string(),
  key: z.string(),
  url: z.string(),
  etag: z.string().optional(),
});
export type FileUploadResultModelType = z.infer<typeof fileUploadResultModel>;
