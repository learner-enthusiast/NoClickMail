import { z } from "zod";
const envSchema = z.object({
  GOOGLE_OAUTH_CLIENT_ID: z.string(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().optional(),
  CORSAIR_KEK: z.string().min(32, "CORSAIR_KEK must be at least 32 chars"),
  CORSAIR_GMAIL_REDIRECT_URI: z.string().url(),
  CORSAIR_CALENDAR_REDIRECT_URI: z.string().url(),
  NODE_ENV: z.enum(["development", "prod"]).default("development"),
  ACCESS_TOKEN_SECRET: z.string().min(32, "ACCESS_TOKEN_SECRET must be at least 32 chars"),
  REFRESH_TOKEN_SECRET: z.string().min(32, "REFRESH_TOKEN_SECRET must be at least 32 chars"),
  ACCESS_TOKEN_EXPIRY: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRY: z.string().default("30d"),
  CLIENT_URL: z.string().default("http://localhost:3000"),
  INTERNAL_URL: z.string().default("http://localhost:8000"),
  CORSAIR_CONNECT_REDIRECT_URI: z.string().url(),
  // packages/services/env.ts — add to the schema
  OPENAI_API_KEY: z.string().min(1),
});

function createEnv(env: NodeJS.ProcessEnv) {
  const safeParseResult = envSchema.safeParse(env);
  if (!safeParseResult.success) throw new Error(safeParseResult.error.message);
  return safeParseResult.data;
}

export const env = createEnv(process.env);
