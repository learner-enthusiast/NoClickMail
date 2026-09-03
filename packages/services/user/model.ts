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

export const generateUSerTokenPayload = z.object({
  id: z.string().describe("UUID of the user"),
});
export type GenerateUSerTokenPayload = z.infer<typeof generateUSerTokenPayload>;

export const successOutputModel = z.object({
  success: z.boolean().describe("Operation result"),
});
export type SuccessOutputModelType = z.infer<typeof successOutputModel>;

export const logoutUserInputModel = z.object({
  userId: z.string().describe("UserID where Refresh token to invalidate"),
});
export type LogoutUserInputModelType = z.infer<typeof logoutUserInputModel>;

export const logoutUserOutputModel = successOutputModel;
export type LogoutUserOutputModelType = z.infer<typeof logoutUserOutputModel>;

export const authenticatedUserInputModel = z.object({
  userId: z.uuid().describe("Authenticated user id"),
});
export type AuthenticatedUserInputModelType = z.infer<typeof authenticatedUserInputModel>;

export const refreshTokenInputModel = z.object({
  refresh_token: z.string().describe("Refresh token"),
});
export type RefreshTokenInputModelType = z.infer<typeof refreshTokenInputModel>;

export const refreshTokenOutputModel = z.object({
  access_token: z.string().describe("New access token"),
  refresh_token: z.string().describe("New refresh token (if rotation enabled)").optional(),
});
export type RefreshTokenOutputModelType = z.infer<typeof refreshTokenOutputModel>;

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
