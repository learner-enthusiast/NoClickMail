import { z } from "zod";
const envSchema = z.object({
  GOOGLE_OAUTH_CLIENT_ID: z.string(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().optional(),
  CORSAIR_KEK: z.string().min(32, "CORSAIR_KEK must be at least 32 chars"),
  CORSAIR_GMAIL_REDIRECT_URI: z.string().url(),
  CORSAIR_CALENDAR_REDIRECT_URI: z.string().url(),
  NODE_ENV: z.enum(["development", "production", "prod"]).default("development"),
  ACCESS_TOKEN_SECRET: z.string().min(32, "ACCESS_TOKEN_SECRET must be at least 32 chars"),
  REFRESH_TOKEN_SECRET: z.string().min(32, "REFRESH_TOKEN_SECRET must be at least 32 chars"),
  ACCESS_TOKEN_EXPIRY: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRY: z.string().default("30d"),
  CLIENT_URL: z.string().default("http://localhost:3000"),
  INTERNAL_URL: z.string().default("http://localhost:8000"),
  CORSAIR_CONNECT_REDIRECT_URI: z.string().url(),
  OPENAI_API_KEY: z.string().min(1),
  /** Pinecone — optional; RAG pipeline skips when unset */
  PINECONE_API_KEY: z.string().min(1).optional(),
  PINECONE_INDEX: z.string().min(1).optional(),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  /** Must match Pinecone index dimension (text-embedding-3-small default is 1536; set 1024 if index uses 1024) */
  OPENAI_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),
  RAG_CHUNK_SIZE: z.coerce.number().int().positive().default(600),
  RAG_CHUNK_OVERLAP: z.coerce.number().int().nonnegative().default(80),
  /** Inngest — set INNGEST_DEV=1 locally with `inngest dev`; cloud keys in production */
  INNGEST_DEV: z.enum(["0", "1"]).optional(),
  INNGEST_EVENT_KEY: z.string().min(1).optional(),
  INNGEST_SIGNING_KEY: z.string().min(1).optional(),
  /** Shared cookie domain for web + API subdomains (e.g. .arnabsamanta.in). Auto-derived from CLIENT_URL when unset. */
  COOKIE_DOMAIN: z.string().min(2).optional(),
});

function createEnv(env: NodeJS.ProcessEnv) {
  const safeParseResult = envSchema.safeParse(env);
  if (!safeParseResult.success) throw new Error(safeParseResult.error.message);
  return safeParseResult.data;
}

export const env = createEnv(process.env);
