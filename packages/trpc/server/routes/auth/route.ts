import { userService } from "../../services";
import * as JWT from "jsonwebtoken";
import { env } from "@repo/services/env";
import {
  logoutUserOutputModel,
  refreshTokenInputModel,
  refreshTokenOutputModel,
  getMeOutputModel,
  getAuthenticationMethodOutputSchema,
  type GenerateUSerTokenPayload,
} from "@repo/services/user/model";
import {
  authenticatedProcedure,
  csrfProcedure,
  publicProcedure,
  router,
} from "../../trpc";
import { generatePath } from "../../utils/path-generator";
import {
  AUTHENTICATION_COOKIE_NAME_ACCESS,
  AUTHENTICATION_COOKIE_NAME_REFRESH,
  clearAllSessionCookies,
  setAuthenticationCookie,
} from "../../cookie";
import { zodUndefinedModel } from "../../schema";
import { z } from "zod";

const TAGS = ["Authentication"];
const getPath = generatePath("/authentication");

function resolveLogoutUserId(ctx: {
  getCookie: (name: string) => string | undefined;
}): string | undefined {
  for (const cookieName of [
    AUTHENTICATION_COOKIE_NAME_ACCESS,
    AUTHENTICATION_COOKIE_NAME_REFRESH,
  ] as const) {
    const token = ctx.getCookie(cookieName);
    if (!token) continue;

    try {
      const secret =
        cookieName === AUTHENTICATION_COOKIE_NAME_ACCESS
          ? env.ACCESS_TOKEN_SECRET
          : env.REFRESH_TOKEN_SECRET;
      const decoded = JWT.verify(token, secret) as GenerateUSerTokenPayload;
      if (decoded.id) return decoded.id;
    } catch {
      const decoded = JWT.decode(token) as GenerateUSerTokenPayload | null;
      if (decoded?.id) return decoded.id;
    }
  }

  return undefined;
}

export const authRouter = router({
  getSupportedAuthenticationProviders: publicProcedure
    .meta({ openapi: { method: "GET", path: getPath("/supported-providers"), tags: TAGS } })
    .input(zodUndefinedModel)
    .output(z.readonly(z.array(getAuthenticationMethodOutputSchema)))
    .query(async () => {
      return userService.getAuthenticationMethods();
    }),

  logout: csrfProcedure
    .meta({ openapi: { method: "POST", path: getPath("/logout"), tags: TAGS } })
    .input(zodUndefinedModel)
    .output(logoutUserOutputModel)
    .mutation(async ({ ctx }) => {
      const userId = resolveLogoutUserId(ctx);
      if (userId) {
        await userService.logout({ userId });
      }
      clearAllSessionCookies(ctx);
      return { success: true };
    }),

  refreshToken: publicProcedure
    .meta({ openapi: { method: "POST", path: getPath("/refresh-token"), tags: TAGS } })
    .input(refreshTokenInputModel)
    .output(refreshTokenOutputModel)
    .mutation(async ({ input, ctx }) => {
      const result = await userService.refreshToken(input);

      setAuthenticationCookie(ctx, result.access_token, AUTHENTICATION_COOKIE_NAME_ACCESS);
      if (result.refresh_token) {
        setAuthenticationCookie(ctx, result.refresh_token, AUTHENTICATION_COOKIE_NAME_REFRESH);
      }

      return result;
    }),

  me: authenticatedProcedure
    .meta({ openapi: { method: "GET", path: getPath("/me"), tags: TAGS } })
    .input(zodUndefinedModel)
    .output(getMeOutputModel)
    .query(async ({ ctx }) => {
      return userService.getMe({ userId: ctx.user });
    }),
});
