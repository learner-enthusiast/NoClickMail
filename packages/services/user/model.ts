import { z } from "zod";

export const getAuthenticationMethodOutputSchema = z.object({
  provider: z.enum(["GOOGLE_OAUTH"]),
  displayName: z.string().optional(),
  displayText: z.string().optional(),
  authUrl: z.string(),
});
export type GetAuthenticationMethodOutputSchema = z.infer<
  typeof getAuthenticationMethodOutputSchema
>;

export const createUserWithEmailandPasswordInputModel = z.object({
  fullName: z.string().describe("Full name of the user").min(8).max(80),
  email: z.email("email name of the user").describe("Email address of the user").max(255),
  password: z.string().describe("Password of the user").min(3).max(200),
});
export type CreateUserWithEmailandPasswordInputModelType = z.infer<
  typeof createUserWithEmailandPasswordInputModel
>;

export const createUserWithEmailandPasswordOutputModel = z.object({
  id: z.uuid().describe("Newly created User Id"),
  access_token: z.string().describe("User Access Token"),
  refresh_token: z.string().describe("User Refresh Token"),
  csrfToken: z.string().describe("User CSRF Token"),
});

export type CreateUserWithEmailandPasswordOutputModelType = z.infer<
  typeof createUserWithEmailandPasswordOutputModel
>;

export const generateUSerTokenPayload = z.object({
  id: z.string().describe("UUID of the user"),
});
export type GenerateUSerTokenPayload = z.infer<typeof generateUSerTokenPayload>;

export const authTokensOutputModel = z.object({
  access_token: z.string().describe("Short-lived access token"),
  refresh_token: z.string().describe("Long-lived refresh token"),
});
export type AuthTokensOutputModelType = z.infer<typeof authTokensOutputModel>;

export const successOutputModel = z.object({
  success: z.boolean().describe("Operation result"),
});
export type SuccessOutputModelType = z.infer<typeof successOutputModel>;

/**
 * POST /auth/login
 * Email/password login
 */
export const loginUserWithEmailandPasswordInputModel = z.object({
  email: z.email("Email of the user").describe("Email address of the user").max(255),
  password: z.string().describe("Password of the user").min(3).max(200),
});
export type LoginUserWithEmailandPasswordInputModelType = z.infer<
  typeof loginUserWithEmailandPasswordInputModel
>;

export const loginUserWithEmailandPasswordOutputModel = z.object({
  id: z.uuid().describe("User Id"),
  access_token: z.string().describe("User access token"),
  refresh_token: z.string().describe("User refresh token"),
  csrfToken: z.string().describe("User csrf token"),
});
export type LoginUserWithEmailandPasswordOutputModelType = z.infer<
  typeof loginUserWithEmailandPasswordOutputModel
>;

/**
 * POST /auth/logout
 * Remove refresh token/session
 *
 * If you store refresh token in an HttpOnly cookie, you can switch this input to `z.undefined()`.
 */
export const logoutUserInputModel = z.object({
  userId: z.string().describe("UserID where Refresh token to invalidate"),
});
export type LogoutUserInputModelType = z.infer<typeof logoutUserInputModel>;

export const logoutUserOutputModel = successOutputModel;
export type LogoutUserOutputModelType = z.infer<typeof logoutUserOutputModel>;

// Shared: authenticated routes always receive userId
export const authenticatedUserInputModel = z.object({
  userId: z.uuid().describe("Authenticated user id"),
});
export type AuthenticatedUserInputModelType = z.infer<typeof authenticatedUserInputModel>;

/**
 * POST /auth/refresh-token (NOT authenticated)
 * Generate new access token using refresh token
 */
export const refreshTokenInputModel = z.object({
  refresh_token: z.string().describe("Refresh token"),
});
export type RefreshTokenInputModelType = z.infer<typeof refreshTokenInputModel>;

export const refreshTokenOutputModel = z.object({
  access_token: z.string().describe("New access token"),
  refresh_token: z.string().describe("New refresh token (if rotation enabled)").optional(),
});
export type RefreshTokenOutputModelType = z.infer<typeof refreshTokenOutputModel>;

/**
 * GET /auth/me (authenticated)
 */
export const getMeInputModel = authenticatedUserInputModel;
export type GetMeInputModelType = z.infer<typeof getMeInputModel>;

export const getMeOutputModel = z.object({
  id: z.uuid().describe("User Id"),
  fullName: z.string().describe("Full name").max(80),
  email: z.string().describe("Email").max(255),
  emailVerified: z.boolean().describe("Is email verified"),
  profileImageUrl: z.string().nullable().optional().describe("Profile image URL"),
});
export type GetMeOutputModelType = z.infer<typeof getMeOutputModel>;

/**
 * POST /auth/verify-email (authenticated)
 * Verify email using token/OTP
 */
export const verifyEmailInputModel = authenticatedUserInputModel.extend({
  token: z.string().describe("Email verification token/OTP"),
});
export type VerifyEmailInputModelType = z.infer<typeof verifyEmailInputModel>;

export const verifyEmailOutputModel = successOutputModel;
export type VerifyEmailOutputModelType = z.infer<typeof verifyEmailOutputModel>;

/**
 * POST /auth/resend-verification (authenticated)
 */
export const resendVerificationEmailInputModel = authenticatedUserInputModel;
export type ResendVerificationEmailInputModelType = z.infer<
  typeof resendVerificationEmailInputModel
>;

export const resendVerificationEmailOutputModel = successOutputModel;
export type ResendVerificationEmailOutputModelType = z.infer<
  typeof resendVerificationEmailOutputModel
>;

/**
 * POST /auth/forgot-password (authenticated, per your requirement)
 * Send reset password link/OTP
 */
export const forgotPasswordInputModel = authenticatedUserInputModel;
export type ForgotPasswordInputModelType = z.infer<typeof forgotPasswordInputModel>;

export const forgotPasswordOutputModel = successOutputModel;
export type ForgotPasswordOutputModelType = z.infer<typeof forgotPasswordOutputModel>;

/**
 * POST /auth/reset-password (authenticated, per your requirement)
 * Reset password using token
 */
export const resetPasswordInputModel = authenticatedUserInputModel.extend({
  token: z.string().describe("Password reset token/OTP"),
  newPassword: z.string().describe("New password").min(3).max(200),
});
export type ResetPasswordInputModelType = z.infer<typeof resetPasswordInputModel>;

export const resetPasswordOutputModel = successOutputModel;
export type ResetPasswordOutputModelType = z.infer<typeof resetPasswordOutputModel>;

/**
 * POST /auth/change-password (authenticated)
 */
export const changePasswordInputModel = authenticatedUserInputModel.extend({
  currentPassword: z.string().describe("Current password").min(3).max(200),
  newPassword: z.string().describe("New password").min(3).max(200),
});
export type ChangePasswordInputModelType = z.infer<typeof changePasswordInputModel>;

export const changePasswordOutputModel = successOutputModel;
export type ChangePasswordOutputModelType = z.infer<typeof changePasswordOutputModel>;
