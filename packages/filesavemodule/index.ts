import { PutObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "./env";
import { badRequest, normalizeFileSaveError } from "./error";
import {
  r2UploadInputModel,
  s3UploadInputModel,
  type FileUploadResultModelType,
  type R2UploadInputModelType,
  type S3UploadInputModelType,
} from "./model";

export type {
  FileUploadResultModelType,
  R2UploadInputModelType,
  S3UploadInputModelType,
} from "./model";
export { fileUploadResultModel, r2UploadInputModel, s3UploadInputModel } from "./model";

function resolveS3Config(input: S3UploadInputModelType) {
  const bucket = input.bucket ?? env.AWS_S3_BUCKET;
  const region = input.region ?? env.AWS_REGION;
  const accessKeyId = input.accessKeyId ?? env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = input.secretAccessKey ?? env.AWS_SECRET_ACCESS_KEY;
  const endpoint = input.endpoint ?? env.AWS_S3_ENDPOINT;
  const forcePathStyle =
    input.forcePathStyle ??
    (env.AWS_S3_FORCE_PATH_STYLE
      ? env.AWS_S3_FORCE_PATH_STYLE === "true"
      : Boolean(endpoint));
  const publicBaseUrl = input.publicBaseUrl ?? env.AWS_S3_PUBLIC_BASE_URL;

  if (!bucket || !region || !accessKeyId || !secretAccessKey) {
    throw badRequest(
      "S3 is not configured. Set AWS_S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY.",
    );
  }

  return { bucket, region, accessKeyId, secretAccessKey, endpoint, forcePathStyle, publicBaseUrl };
}

function resolveR2Config(input: R2UploadInputModelType) {
  const accountId = input.accountId ?? env.R2_ACCOUNT_ID;
  const bucket = input.bucket ?? env.R2_BUCKET;
  const accessKeyId = input.accessKeyId ?? env.R2_ACCESS_KEY_ID;
  const secretAccessKey = input.secretAccessKey ?? env.R2_SECRET_ACCESS_KEY;
  const publicBaseUrl = input.publicBaseUrl ?? env.R2_PUBLIC_BASE_URL;

  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    throw badRequest(
      "R2 is not configured. Set R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.",
    );
  }

  return { accountId, bucket, accessKeyId, secretAccessKey, publicBaseUrl };
}

function buildObjectUrl(
  provider: "s3" | "r2",
  bucket: string,
  key: string,
  opts: { region?: string; accountId?: string; publicBaseUrl?: string },
): string {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  if (opts.publicBaseUrl) {
    return `${opts.publicBaseUrl.replace(/\/$/, "")}/${encodedKey}`;
  }
  if (provider === "r2" && opts.accountId) {
    return `https://${opts.accountId}.r2.cloudflarestorage.com/${bucket}/${encodedKey}`;
  }
  if (provider === "s3" && opts.region) {
    return `https://${bucket}.s3.${opts.region}.amazonaws.com/${encodedKey}`;
  }
  return `s3://${bucket}/${key}`;
}

function isR2Configured(): boolean {
  return Boolean(
    env.R2_ACCOUNT_ID &&
      env.R2_BUCKET &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY,
  );
}

function isS3Configured(): boolean {
  return Boolean(
    env.AWS_S3_BUCKET &&
      env.AWS_REGION &&
      env.AWS_ACCESS_KEY_ID &&
      env.AWS_SECRET_ACCESS_KEY,
  );
}

class FileSaveService {
  async uploadToS3(input: S3UploadInputModelType): Promise<FileUploadResultModelType> {
    const parsed = s3UploadInputModel.parse(input);
    const { bucket, region, accessKeyId, secretAccessKey, endpoint, forcePathStyle, publicBaseUrl } =
      resolveS3Config(parsed);

    const client = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
      ...(endpoint
        ? {
            endpoint,
            forcePathStyle,
          }
        : {}),
    });

    try {
      const result = await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: parsed.key,
          Body: parsed.body,
          ContentType: parsed.contentType,
          Metadata: parsed.metadata,
        }),
      );

      return {
        provider: "s3",
        bucket,
        key: parsed.key,
        url: buildObjectUrl("s3", bucket, parsed.key, { region, publicBaseUrl }),
        etag: result.ETag?.replace(/"/g, ""),
      };
    } catch (err) {
      throw normalizeFileSaveError(err);
    }
  }

  async uploadToR2(input: R2UploadInputModelType): Promise<FileUploadResultModelType> {
    const parsed = r2UploadInputModel.parse(input);
    const { accountId, bucket, accessKeyId, secretAccessKey, publicBaseUrl } =
      resolveR2Config(parsed);

    const client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    try {
      const result = await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: parsed.key,
          Body: parsed.body,
          ContentType: parsed.contentType,
          Metadata: parsed.metadata,
        }),
      );

      return {
        provider: "r2",
        bucket,
        key: parsed.key,
        url: buildObjectUrl("r2", bucket, parsed.key, { accountId, publicBaseUrl }),
        etag: result.ETag?.replace(/"/g, ""),
      };
    } catch (err) {
      throw normalizeFileSaveError(err);
    }
  }

  private resolveDownloadClient(): {
    client: S3Client;
    bucket: string;
    provider: "s3" | "r2";
  } {
    if (isR2Configured()) {
      const accountId = env.R2_ACCOUNT_ID!;
      const bucket = env.R2_BUCKET!;
      return {
        provider: "r2",
        bucket,
        client: new S3Client({
          region: "auto",
          endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: env.R2_ACCESS_KEY_ID!,
            secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
          },
        }),
      };
    }

    if (isS3Configured()) {
      const endpoint = env.AWS_S3_ENDPOINT;
      const forcePathStyle =
        env.AWS_S3_FORCE_PATH_STYLE === "true" || (env.AWS_S3_FORCE_PATH_STYLE !== "false" && Boolean(endpoint));
      return {
        provider: "s3",
        bucket: env.AWS_S3_BUCKET!,
        client: new S3Client({
          region: env.AWS_REGION!,
          credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
          },
          ...(endpoint ? { endpoint, forcePathStyle } : {}),
        }),
      };
    }

    throw badRequest(
      "File storage is not configured. Set AWS_S3_* or R2_* environment variables.",
    );
  }

  async getObject(key: string): Promise<Buffer> {
    const { client, bucket } = this.resolveDownloadClient();

    try {
      const result = await client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );

      const chunks: Uint8Array[] = [];
      const stream = result.Body;
      if (!stream) throw badRequest(`Object not found: ${key}`);

      for await (const chunk of stream as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }

      return Buffer.concat(chunks);
    } catch (err) {
      throw normalizeFileSaveError(err);
    }
  }
}

export default FileSaveService;
