import { userService } from "../../services";
import {
  createUserWithEmailandPasswordInputModel,
  createUserWithEmailandPasswordOutputModel,
  loginUserWithEmailandPasswordInputModel,
  loginUserWithEmailandPasswordOutputModel,
  logoutUserOutputModel,
  refreshTokenInputModel,
  refreshTokenOutputModel,
  getMeOutputModel,
  verifyEmailInputModel,
  verifyEmailOutputModel,
  resendVerificationEmailOutputModel,
  forgotPasswordOutputModel,
  resetPasswordInputModel,
  resetPasswordOutputModel,
  changePasswordInputModel,
  changePasswordOutputModel,
  getAuthenticationMethodOutputSchema,
} from "@repo/services/user/model";
import {
  authenticatedProcedure,
  csrfProtectedProcedure,
  publicProcedure,
  router,
} from "../../trpc";
import { generatePath } from "../../utils/path-generator";
import {
  AUTHENTICATION_COOKIE_NAME_ACCESS,
  AUTHENTICATION_COOKIE_NAME_REFRESH,
  clearAuthenticationCookie,
  defaultCookieOptions,
  setAuthenticationCookie,
} from "../../cookie";
import { zodUndefinedModel } from "../../schema";
import { z } from "zod";
const TAGS = ["Authentication"];
const getPath = generatePath("/authentication");

export const authRouter = router({
  getSupportedAuthenticationProviders: publicProcedure
    .meta({ openapi: { method: "GET", path: getPath("/supported-providers"), tags: TAGS } })
    .input(zodUndefinedModel)
    .output(z.readonly(z.array(getAuthenticationMethodOutputSchema)))
    .query(async () => {
      const supportedMethods = await userService.getAuthenticationMethods();
      return supportedMethods;
    }),
  createUserWithEmailandPassword: publicProcedure
    .meta({ openapi: { method: "POST", path: getPath("/signUp"), tags: TAGS } })
    .input(createUserWithEmailandPasswordInputModel)
    .output(createUserWithEmailandPasswordOutputModel)
    .mutation(async ({ input, ctx }) => {
      const { fullName, email, password } = input;
      const { id, access_token, refresh_token, csrfToken } =
        await userService.createUserWithEmailandPassword({
          fullName,
          email,
          password,
        });
      setAuthenticationCookie(ctx, access_token, AUTHENTICATION_COOKIE_NAME_ACCESS);
      setAuthenticationCookie(ctx, refresh_token, AUTHENTICATION_COOKIE_NAME_REFRESH);
      ctx.createCookie("csrf_token", csrfToken, {
        ...defaultCookieOptions,
        httpOnly: false,
      });
      return { id, access_token, refresh_token, csrfToken };
    }),
  loginUserWithEmailandPassword: publicProcedure
    .meta({ openapi: { method: "POST", path: getPath("/login"), tags: TAGS } })
    .input(loginUserWithEmailandPasswordInputModel)
    .output(loginUserWithEmailandPasswordOutputModel)
    .mutation(async ({ input, ctx }) => {
      const { id, access_token, refresh_token, csrfToken } =
        await userService.loginUserWithEmailandPassword(input);

      setAuthenticationCookie(ctx, access_token, AUTHENTICATION_COOKIE_NAME_ACCESS);
      setAuthenticationCookie(ctx, refresh_token, AUTHENTICATION_COOKIE_NAME_REFRESH);
      ctx.createCookie("csrf_token", csrfToken, {
        ...defaultCookieOptions,
        httpOnly: false,
      });

      return { id, access_token, refresh_token, csrfToken };
    }),

  logout: csrfProtectedProcedure
    .meta({ openapi: { method: "POST", path: getPath("/logout"), tags: TAGS } })
    .input(zodUndefinedModel)
    .output(logoutUserOutputModel)
    .query(async ({ ctx }) => {
      await userService.logout({ userId: ctx.user });
      clearAuthenticationCookie(ctx, AUTHENTICATION_COOKIE_NAME_ACCESS);
      clearAuthenticationCookie(ctx, AUTHENTICATION_COOKIE_NAME_REFRESH);
      ctx.clearCookie("csrf_token", { ...defaultCookieOptions, httpOnly: false });
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

  verifyEmail: csrfProtectedProcedure
    .meta({ openapi: { method: "POST", path: getPath("/verify-email"), tags: TAGS } })
    .input(verifyEmailInputModel.omit({ userId: true }))
    .output(verifyEmailOutputModel)
    .mutation(async ({ input, ctx }) => {
      return userService.verifyEmail({ userId: ctx.user, ...input });
    }),

  resendVerification: csrfProtectedProcedure
    .meta({ openapi: { method: "POST", path: getPath("/resend-verification"), tags: TAGS } })
    .input(zodUndefinedModel)
    .output(resendVerificationEmailOutputModel)
    .mutation(async ({ ctx }) => {
      return userService.resendVerificationEmail({ userId: ctx.user });
    }),

  forgotPassword: csrfProtectedProcedure
    .meta({ openapi: { method: "POST", path: getPath("/forgot-password"), tags: TAGS } })
    .input(zodUndefinedModel)
    .output(forgotPasswordOutputModel)
    .mutation(async ({ ctx }) => {
      return userService.forgotPassword({ userId: ctx.user });
    }),

  resetPassword: csrfProtectedProcedure
    .meta({ openapi: { method: "POST", path: getPath("/reset-password"), tags: TAGS } })
    .input(resetPasswordInputModel.omit({ userId: true }))
    .output(resetPasswordOutputModel)
    .mutation(async ({ input, ctx }) => {
      return userService.resetPassword({ userId: ctx.user, ...input });
    }),

  changePassword: csrfProtectedProcedure
    .meta({ openapi: { method: "POST", path: getPath("/change-password"), tags: TAGS } })
    .input(changePasswordInputModel.omit({ userId: true }))
    .output(changePasswordOutputModel)
    .mutation(async ({ input, ctx }) => {
      return userService.changePassword({ userId: ctx.user, ...input });
    }),
});
