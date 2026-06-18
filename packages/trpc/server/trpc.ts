import { initTRPC, TRPCError } from "@trpc/server";
import { OpenApiMeta } from "trpc-to-openapi";
import * as JWT from "jsonwebtoken";
import { createContext } from "./context";
import {
  AUTHENTICATION_COOKIE_NAME_ACCESS,
  getAuthenticationCookie,
  getCsrfCookie,
} from "./cookie";
import { GenerateUSerTokenPayload } from "@repo/services/user/model";
import { env } from "@repo/services/env";
import { toTRPCError } from "./map-error";
import { checkRateLimit, type RateLimitOptions } from "./rate-limit";

export const tRPCContext = initTRPC
  .meta<OpenApiMeta>()
  .context<typeof createContext>()
  .create({
    errorFormatter({ shape, error }) {
      const isProd = env.NODE_ENV === "production";

      return {
        ...shape,
        message:
          isProd && error.code === "INTERNAL_SERVER_ERROR" ? "Something went wrong" : shape.message,
        data: {
          ...shape.data,
          stack: isProd ? undefined : shape.data.stack,
        },
      };
    },
  });

export const router = tRPCContext.router;

const errorHandlerMiddleware = tRPCContext.middleware(async ({ next }) => {
  try {
    return await next();
  } catch (err) {
    throw toTRPCError(err);
  }
});
export const publicProcedure = tRPCContext.procedure.use(errorHandlerMiddleware);

export const authenticatedProcedure = publicProcedure.use((options) => {
  const { ctx } = options;

  const userToken = getAuthenticationCookie(ctx, AUTHENTICATION_COOKIE_NAME_ACCESS);
  if (!userToken) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not logged in" });
  }

  try {
    const decoded = JWT.verify(userToken, env.ACCESS_TOKEN_SECRET) as GenerateUSerTokenPayload;
    return options.next({
      ctx: { ...ctx, user: decoded.id },
    });
  } catch {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired token" });
  }
});
export const csrfProtectedProcedure = authenticatedProcedure.use((options) => {
  // Only require CSRF for mutations
  if (options.type !== "mutation") return options.next();

  const csrfCookie = getCsrfCookie(options.ctx);
  const csrfHeader = options.ctx.getHeader("x-csrf-token");

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    throw new TRPCError({ code: "FORBIDDEN", message: "CSRF token mismatch" });
  }

  return options.next();
});
function createRateLimitMiddleware(opts: RateLimitOptions) {
  return tRPCContext.middleware(async ({ ctx, next }) => {
    const user = "user" in ctx ? (ctx as { user?: string }).user : undefined;
    const key = opts.key({ ip: ctx.ip, user });
    checkRateLimit(key, opts.max, opts.windowMs);
    return next();
  });
}
export const ipAuthRateLimit = createRateLimitMiddleware({
  max: 5,
  windowMs: 15 * 60 * 1000,
  key: ({ ip }) => `auth:ip:${ip}`,
});
export const userAgentRateLimit = createRateLimitMiddleware({
  max: 20,
  windowMs: 60 * 1000,
  key: ({ user, ip }) => `agent:user:${user ?? ip}`,
});
export const authPublicProcedure = publicProcedure.use(ipAuthRateLimit);
export const agentProcedure = csrfProtectedProcedure.use(userAgentRateLimit);
