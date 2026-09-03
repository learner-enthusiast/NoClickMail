import * as JWT from "jsonwebtoken";
import { and, db, eq } from "@repo/database";
import { usersTable } from "@repo/database/models/user";
import { env } from "../env";
import { googleOAuth2Client } from "../clients/google-oauth";
import { unauthorized, notFound } from "../error";
import {
  GenerateUSerTokenPayload,
  GetAuthenticationMethodOutputSchema,
  LogoutUserInputModelType,
  LogoutUserOutputModelType,
  RefreshTokenInputModelType,
  RefreshTokenOutputModelType,
  GetMeInputModelType,
  GetMeOutputModelType,
} from "./model";

class UserService {
  public async getAuthenticationMethods(): Promise<
    ReadonlyArray<GetAuthenticationMethodOutputSchema>
  > {
    const supportedAuthenticationProviders: GetAuthenticationMethodOutputSchema[] = [];

    const isGoogleConfigured = !!(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET);

    if (isGoogleConfigured) {
      const url = googleOAuth2Client.generateAuthUrl({
        scope: "openid email profile",
      });
      supportedAuthenticationProviders.push({
        provider: "GOOGLE_OAUTH",
        displayName: "Google",
        displayText: "Signin with Google",
        authUrl: url,
      });
    }

    return supportedAuthenticationProviders;
  }

  private async generateUserToken(
    payload: GenerateUSerTokenPayload,
    secret: JWT.Secret,
    expiry: string,
  ) {
    const { id } = payload;

    const token = JWT.sign({ id }, secret, { expiresIn: expiry as JWT.SignOptions["expiresIn"] });

    return { token };
  }

  private async verifyUserToken(token: string, secret: JWT.Secret) {
    try {
      const decoded = JWT.verify(token, secret) as GenerateUSerTokenPayload;

      return {
        valid: true,
        decoded,
      };
    } catch {
      return {
        valid: false,
        decoded: null,
      };
    }
  }

  public async logout(payload: LogoutUserInputModelType): Promise<LogoutUserOutputModelType> {
    const { userId } = payload;

    if (typeof userId === "string" && userId.length > 0) {
      await db
        .update(usersTable)
        .set({ refreshToken: null })
        .where(and(eq(usersTable.id, userId)));
    }

    return { success: true };
  }

  private async getUserById(userId: string) {
    const result = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    return result?.[0] ?? null;
  }

  public async refreshToken(
    payload: RefreshTokenInputModelType,
  ): Promise<RefreshTokenOutputModelType> {
    const { refresh_token } = payload;

    const verification = await this.verifyUserToken(refresh_token, env.REFRESH_TOKEN_SECRET);
    if (!verification.valid || !verification.decoded?.id) {
      throw unauthorized("Invalid refresh token");
    }

    const user = await this.getUserById(verification.decoded.id);
    if (!user || !user.refreshToken || user.refreshToken !== refresh_token) {
      throw unauthorized("Invalid refresh token");
    }

    const accessTokenObj = await this.generateUserToken(
      { id: user.id },
      env.ACCESS_TOKEN_SECRET,
      env.ACCESS_TOKEN_EXPIRY,
    );

    const newRefreshTokenObj = await this.generateUserToken(
      { id: user.id },
      env.REFRESH_TOKEN_SECRET,
      env.REFRESH_TOKEN_EXPIRY,
    );

    await db
      .update(usersTable)
      .set({ refreshToken: newRefreshTokenObj.token })
      .where(eq(usersTable.id, user.id));

    return { access_token: accessTokenObj.token, refresh_token: newRefreshTokenObj.token };
  }

  public async getMe(payload: GetMeInputModelType): Promise<GetMeOutputModelType> {
    const { userId } = payload;

    const user = await this.getUserById(userId);
    if (!user) throw notFound("User not found");

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      emailVerified: !!user.emailVerified,
      profileImageUrl: user.profileImageUrl ?? null,
    };
  }
}

export default UserService;
