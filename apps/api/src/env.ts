import { z } from "zod";
function emptyToUndefined(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}
function normalizeEnvUrl(value: string) {
  return value
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .replace(/\/$/, "");
}
const envSchema = z.object({
  PORT: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "prod"]).default("development"),
  BASE_URL: z.string().default("http://localhost:8000"),
  CORS_ORIGIN: z.string().optional(),
  CLIENT_URL: z.string().default("http://localhost:3000"),
  OPENAPI_DOCS_SECRET: z.preprocess(emptyToUndefined, z.string().min(8).optional()),
  PUBLIC_OPENAPI_DOCS: z.enum(["true", "false"]).optional(),
  CORSAIR_WEBHOOK_SECRET: z.preprocess(emptyToUndefined, z.string().min(16).optional()),
  CORSAIR_CONNECT_REDIRECT_URI: z.string().url(),
  GMAIL_PUBSUB_TOPIC_ID: z.string().optional(),
  CORSAIR_WEBHOOK_BASE: z.string().url(),
});
function defaultPublicOpenApiDocs(nodeEnv: string) {
  return nodeEnv === "development" || nodeEnv === "test" ? "true" : "false";
}
function createEnv(env: NodeJS.ProcessEnv) {
  const safeParseResult = envSchema.safeParse(env);
  if (!safeParseResult.success) throw new Error(safeParseResult.error.message);
  const data = safeParseResult.data;
  return {
    ...data,
    BASE_URL: normalizeEnvUrl(data.BASE_URL),
    CLIENT_URL: normalizeEnvUrl(data.CLIENT_URL),
    PUBLIC_OPENAPI_DOCS: data.PUBLIC_OPENAPI_DOCS ?? defaultPublicOpenApiDocs(data.NODE_ENV),
  };
}

export const env = createEnv(process.env);
