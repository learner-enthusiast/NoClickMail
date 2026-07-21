import { CookieOptions, Request, Response } from "express";
import { TRPCContext } from "./context";
import { env } from "@repo/services/env";

const ONE_MINUTE = 60 * 1000;
const ONE_HOUR = 60 * ONE_MINUTE;
const ONE_DAY = 24 * ONE_HOUR;
const ONE_MONTH = 30 * ONE_DAY;
const ONE_YEAR = 12 * ONE_MONTH;

export const isProductionEnv =
  env.NODE_ENV === "production" || env.NODE_ENV === "prod";

/** Parent domain for cross-subdomain cookies (orion.* + orionserver.*). */
export function resolveCookieDomain(): string | undefined {
  if (env.COOKIE_DOMAIN) return env.COOKIE_DOMAIN;

  try {
    const { hostname } = new URL(env.CLIENT_URL);
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
    ) {
      return undefined;
    }

    const parts = hostname.split(".");
    if (parts.length >= 3) {
      return `.${parts.slice(-2).join(".")}`;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export function sharedCookieOptions(overrides: CookieOptions = {}): CookieOptions {
  const domain = resolveCookieDomain();
  return {
    path: "/",
    httpOnly: true,
    secure: isProductionEnv,
    sameSite: "lax",
    maxAge: ONE_YEAR,
    ...(domain ? { domain } : {}),
    ...overrides,
  };
}

export const defaultCookieOptions: CookieOptions = sharedCookieOptions();

export function createCookieFactory(res: Response) {
  return function createCookie(
    name: string,
    value: string,
    opts: CookieOptions = defaultCookieOptions,
  ) {
    res.cookie(name, value, opts);
  };
}

export function getCookieFactory(req: Request) {
  return function getCookie(name: string): string | undefined {
    const value = req.cookies?.[name];
    return typeof value === "string" ? value : undefined;
  };
}

export function clearCookieFactory(res: Response) {
  return function deleteCookie(name: string, opts: CookieOptions = defaultCookieOptions) {
    const { maxAge: _maxAge, expires: _expires, ...rest } = opts;
    res.clearCookie(name, rest);
  };
}

/** Clear a cookie set with shared domain and legacy host-only variants. */
export function clearCookieEverywhere(
  ctx: TRPCContext,
  name: string,
  opts: CookieOptions = defaultCookieOptions,
) {
  ctx.clearCookie(name, opts);
  const { domain: _domain, ...hostOnlyOpts } = opts;
  ctx.clearCookie(name, hostOnlyOpts);
}

export const AUTHENTICATION_COOKIE_NAME_ACCESS = "access_authentication-token";
export const AUTHENTICATION_COOKIE_NAME_REFRESH = "refresh_authentication-token";

export function setAuthenticationCookie(
  ctx: TRPCContext,
  accessToken: string,
  AUTHENTICATION_COOKIE_NAME: string,
) {
  ctx.createCookie(AUTHENTICATION_COOKIE_NAME, accessToken);
}

export function getAuthenticationCookie(
  ctx: TRPCContext,
  AUTHENTICATION_COOKIE_NAME: string,
): string | undefined {
  return ctx.getCookie(AUTHENTICATION_COOKIE_NAME);
}

export function clearAuthenticationCookie(ctx: TRPCContext, AUTHENTICATION_COOKIE_NAME: string) {
  clearCookieEverywhere(ctx, AUTHENTICATION_COOKIE_NAME);
}

export const CSRF_COOKIE_NAME = "csrf_token";

export const csrfCookieOptions = sharedCookieOptions({ httpOnly: false });

export function setCsrfCookie(ctx: TRPCContext, token: string) {
  ctx.createCookie(CSRF_COOKIE_NAME, token, csrfCookieOptions);
}

export function clearCsrfCookie(ctx: TRPCContext) {
  clearCookieEverywhere(ctx, CSRF_COOKIE_NAME, csrfCookieOptions);
}

export function clearAllSessionCookies(ctx: TRPCContext) {
  clearAuthenticationCookie(ctx, AUTHENTICATION_COOKIE_NAME_ACCESS);
  clearAuthenticationCookie(ctx, AUTHENTICATION_COOKIE_NAME_REFRESH);
  clearCsrfCookie(ctx);
}

export function getCsrfCookie(ctx: TRPCContext) {
  return ctx.getCookie(CSRF_COOKIE_NAME);
}
