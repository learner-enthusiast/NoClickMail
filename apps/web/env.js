import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "production", "prod"]).default("development"),
    API_INTERNAL_URL: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().optional(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    API_INTERNAL_URL: process.env.API_INTERNAL_URL,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
