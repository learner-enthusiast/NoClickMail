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
function parseCorsOrigins(value: string | undefined, fallback: string): string[] {
  const raw = value ?? fallback;
  return [...new Set(raw.split(",").map((o) => normalizeEnvUrl(o)).filter(Boolean))];
}
const envSchema = z.object({
  PORT: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "prod"]).default("development"),
  BASE_URL: z.string().default("http://localhost:8000"),
  CORS_ORIGIN: z.string().optional(),
  CLIENT_URL: z.string().default("http://localhost:3000"),
  PUBLIC_OPENAPI_DOCS: z.enum(["true", "false"]).optional(),
  CORSAIR_CONNECT_REDIRECT_URI: z.string().url().optional(),
  GMAIL_PUBSUB_TOPIC_ID: z.string().optional(),
  /** Public HTTPS API base for webhooks — defaults to BASE_URL (same origin when nginx proxies /webhooks) */
  CORSAIR_WEBHOOK_BASE: z.string().url().optional(),
  CORSAIR_WEBHOOK_SECRET: z.preprocess(emptyToUndefined, z.string().min(16)),
});
function defaultPublicOpenApiDocs(nodeEnv: string) {
  return nodeEnv === "development" || nodeEnv === "test" ? "true" : "false";
}
function createEnv(env: NodeJS.ProcessEnv) {
  const safeParseResult = envSchema.safeParse(env);
  if (!safeParseResult.success) throw new Error(safeParseResult.error.message);
  const data = safeParseResult.data;
  const baseUrl = normalizeEnvUrl(data.BASE_URL);
  const clientUrl = normalizeEnvUrl(data.CLIENT_URL);
  return {
    ...data,
    BASE_URL: baseUrl,
    CLIENT_URL: clientUrl,
    CORS_ORIGINS: parseCorsOrigins(data.CORS_ORIGIN, clientUrl),
    PUBLIC_OPENAPI_DOCS: data.PUBLIC_OPENAPI_DOCS ?? defaultPublicOpenApiDocs(data.NODE_ENV),
    CORSAIR_CONNECT_REDIRECT_URI:
      data.CORSAIR_CONNECT_REDIRECT_URI ?? `${clientUrl}/connect/callback`,
    CORSAIR_WEBHOOK_BASE: data.CORSAIR_WEBHOOK_BASE ?? baseUrl,
  };
}

export const env = createEnv(process.env);
