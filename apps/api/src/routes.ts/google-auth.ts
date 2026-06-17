import { Router } from "express";
import * as JWT from "jsonwebtoken";
import { z } from "zod";
import { logger } from "@repo/logger";

import { env as serviceEnv } from "../../../../packages/services/env";

import { env as apiEnv } from "../env";
import { usersTable } from "../../../../packages/database/models/user";
import { googleOAuth2Client } from "../../../../packages/services/clients/google-oauth";
import db, { and, eq } from "../../../../packages/database";

export const googleAuthRouter = Router();

const googleCallbackQuerySchema = z.object({
  code: z.string().min(1).optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;

const authCookieOptions = {
  path: "/",
  httpOnly: true,
  secure: apiEnv.NODE_ENV === "prod" || apiEnv.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: ONE_YEAR,
};

function createAccessToken(userId: string) {
  return JWT.sign({ id: userId }, serviceEnv.ACCESS_TOKEN_SECRET, {
    expiresIn: serviceEnv.ACCESS_TOKEN_EXPIRY as JWT.SignOptions["expiresIn"],
  });
}

function createRefreshToken(userId: string) {
  return JWT.sign({ id: userId }, serviceEnv.REFRESH_TOKEN_SECRET, {
    expiresIn: serviceEnv.REFRESH_TOKEN_EXPIRY as JWT.SignOptions["expiresIn"],
  });
}

function createCsrfToken() {
  return crypto.randomUUID().replaceAll("-", "");
}

googleAuthRouter.get("/google/callback", async (req, res) => {
  const parsed = googleCallbackQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.redirect(
      `${apiEnv.CLIENT_URL}/api-auth/login?error=${encodeURIComponent(
        "Invalid Google sign-in callback.",
      )}`,
    );
  }

  const { code, error: oauthError, error_description: errorDescription } = parsed.data;

  if (oauthError) {
    return res.redirect(
      `${apiEnv.CLIENT_URL}/api-auth/login?error=${encodeURIComponent(
        errorDescription ?? "Google sign-in was cancelled or denied.",
      )}`,
    );
  }

  if (!code) {
    return res.redirect(
      `${apiEnv.CLIENT_URL}/api-auth/login?error=${encodeURIComponent(
        "Start sign-in from the login page. Do not open the callback URL directly.",
      )}`,
    );
  }

  try {
    const { tokens } = await googleOAuth2Client.getToken(code);

    if (!tokens.id_token) {
      throw new Error("Google did not return an ID token.");
    }

    const ticket = await googleOAuth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: serviceEnv.GOOGLE_OAUTH_CLIENT_ID,
    });

    const googleUser = ticket.getPayload();

    if (!googleUser?.email) {
      throw new Error("Google account did not return an email address.");
    }

    const existingUsers = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, googleUser.email));

    let user = existingUsers[0];

    if (!user) {
      const insertedUsers = await db
        .insert(usersTable)
        .values({
          email: googleUser.email,
          fullName: googleUser.name ?? googleUser.email,
          emailVerified: googleUser.email_verified ?? false,
          profileImageUrl: googleUser.picture ?? null,
          password: null,
          salt: null,
        })
        .returning();

      user = insertedUsers[0];

      if (!user) {
        throw new Error("Failed to create Google user.");
      }
    }

    const accessToken = createAccessToken(user.id);
    const refreshToken = createRefreshToken(user.id);
    const csrfToken = createCsrfToken();

    await db
      .update(usersTable)
      .set({ refreshToken })
      .where(and(eq(usersTable.id, user.id)));

    res.cookie("access_authentication-token", accessToken, authCookieOptions);
    res.cookie("refresh_authentication-token", refreshToken, authCookieOptions);
    res.cookie("csrf_token", csrfToken, {
      ...authCookieOptions,
      httpOnly: false,
    });

    return res.redirect(apiEnv.CLIENT_URL);
  } catch (error) {
    logger.error("Google OAuth callback failed", {
      error,
    });

    return res.redirect(
      `${apiEnv.CLIENT_URL}/api-auth/login?error=${encodeURIComponent(
        "Google sign-in failed. Please try again.",
      )}`,
    );
  }
});
