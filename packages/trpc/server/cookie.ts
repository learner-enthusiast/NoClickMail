import { CookieOptions, Request, Response } from "express";
import { TRPCContext } from "./context";
const ONE_MINUTE = 60 * 1000;
const ONE_HOUR = 60 * ONE_MINUTE;
const ONE_DAY = 24 * ONE_HOUR;
const ONE_MONTH = 30 * ONE_DAY;
const ONE_YEAR = 12 * ONE_MONTH;

export const defaultCookieOptions: CookieOptions = {
  path: "/",
  httpOnly: true,
  secure: false,
  sameSite: "strict",
  maxAge: ONE_YEAR,
};

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
  ctx.clearCookie(AUTHENTICATION_COOKIE_NAME);
}
export const CSRF_COOKIE_NAME = "csrf_token";

export function setCsrfCookie(ctx: TRPCContext, token: string) {
  ctx.createCookie(CSRF_COOKIE_NAME, token, {
    ...defaultCookieOptions,
    httpOnly: false,
  });
}

export function getCsrfCookie(ctx: TRPCContext) {
  return ctx.getCookie(CSRF_COOKIE_NAME);
}
