import { TRPCError } from "@trpc/server";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (bucket.count >= max) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many requests. Please slow down.",
    });
  }

  bucket.count += 1;
}

export type RateLimitOptions = {
  max: number;
  windowMs: number;
  key: (ctx: { ip: string; user?: string }) => string;
};
