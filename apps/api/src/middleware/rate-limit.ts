import rateLimit from "express-rate-limit";
import type { Request } from "express";

function clientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

const jsonHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIp,
  handler: (_req, res) => {
    res.status(429).json({ error: "Too many requests. Try again later." });
  },
});

/** Strict — auth / connect */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIp,
  handler: (_req, res) => {
    res.status(429).json({ error: "Too many auth attempts. Try again later." });
  },
});

/** General API / tRPC */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIp,
  skip: (req) => req.path === "/health",
});

export { jsonHandler };
