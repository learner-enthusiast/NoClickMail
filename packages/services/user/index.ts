import { createHmac, randomBytes } from "node:crypto";
import * as JWT from "jsonwebtoken";
import { and, db, eq } from "@repo/database";
import { usersTable } from "@repo/database/models/user";
import { env } from "../env";
import { googleOAuth2Client } from "../clients/google-oauth";
import {
  CreateUserWithEmailandPasswordInputModelType,
  CreateUserWithEmailandPasswordOutputModelType,
  GenerateUSerTokenPayload,
  GetAuthenticationMethodOutputSchema,
  LoginUserWithEmailandPasswordInputModelType,
  LoginUserWithEmailandPasswordOutputModelType,
  LogoutUserInputModelType,
  LogoutUserOutputModelType,
  RefreshTokenInputModelType,
  RefreshTokenOutputModelType,
  GetMeInputModelType,
  GetMeOutputModelType,
  VerifyEmailInputModelType,
  VerifyEmailOutputModelType,
  ResendVerificationEmailInputModelType,
  ResendVerificationEmailOutputModelType,
  ForgotPasswordInputModelType,
  ForgotPasswordOutputModelType,
  ResetPasswordInputModelType,
  ResetPasswordOutputModelType,
  ChangePasswordInputModelType,
  ChangePasswordOutputModelType,
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
  private async getUserByEmail(email: string) {
    const result = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (!result || result.length === 0) return null;
    return result[0];
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
    } catch (error) {
      return {
        valid: false,
        decoded: null,
      };
    }
  }
  public async createUserWithEmailandPassword(
    payload: CreateUserWithEmailandPasswordInputModelType,
  ): Promise<CreateUserWithEmailandPasswordOutputModelType> {
    const { email, password, fullName } = payload;
    const existingUserWithemail = await this.getUserByEmail(email);
    if (existingUserWithemail) throw new Error(`USer with ${email} already exists`);
    const salt = randomBytes(16).toString("hex");
    const hash = createHmac("sha256", salt).update(password).digest("hex");
    const userInsertResult = await db
      .insert(usersTable)
      .values({ email, fullName, password: hash, salt: salt })
      .returning({ id: usersTable.id });
    if (!userInsertResult || userInsertResult.length === 0 || !userInsertResult[0]?.id)
      throw new Error("User not created try again");

    let userId = userInsertResult[0].id;
    let accesstokenObj = await this.generateUserToken(
      { id: userId },
      env.ACCESS_TOKEN_SECRET,
      env.ACCESS_TOKEN_EXPIRY,
    );
    let refreshtokenObj = await this.generateUserToken(
      { id: userId },
      env.REFRESH_TOKEN_SECRET,
      env.REFRESH_TOKEN_EXPIRY,
    );
    await db
      .update(usersTable)
      .set({ refreshToken: refreshtokenObj.token })
      .where(eq(usersTable.id, userId));
    const csrfToken = randomBytes(32).toString("hex");
    return {
      id: userId,
      access_token: accesstokenObj.token,
      refresh_token: refreshtokenObj.token,
      csrfToken,
    };
  }
  public async loginUserWithEmailandPassword(
    payload: LoginUserWithEmailandPasswordInputModelType,
  ): Promise<LoginUserWithEmailandPasswordOutputModelType> {
    const { email, password } = payload;

    const user = await this.getUserByEmail(email);

    // Avoid leaking whether the email exists
    if (!user || !user.password || !user.salt) {
      throw new Error("Invalid credentials");
    }

    const computedHash = createHmac("sha256", user.salt).update(password).digest("hex");
    if (computedHash !== user.password) {
      throw new Error("Invalid credentials");
    }

    const accessTokenObj = await this.generateUserToken(
      { id: user.id },
      env.ACCESS_TOKEN_SECRET,
      env.ACCESS_TOKEN_EXPIRY,
    );

    const refreshTokenObj = await this.generateUserToken(
      { id: user.id },
      env.REFRESH_TOKEN_SECRET,
      env.REFRESH_TOKEN_EXPIRY,
    );

    await db
      .update(usersTable)
      .set({ refreshToken: refreshTokenObj.token })
      .where(eq(usersTable.id, user.id));
    const csrfToken = randomBytes(32).toString("hex");
    return {
      id: user.id,
      access_token: accessTokenObj.token,
      refresh_token: refreshTokenObj.token,
      csrfToken: csrfToken,
    };
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
      throw new Error("Invalid refresh token");
    }

    const user = await this.getUserById(verification.decoded.id);
    if (!user || !user.refreshToken || user.refreshToken !== refresh_token) {
      throw new Error("Invalid refresh token");
    }

    const accessTokenObj = await this.generateUserToken(
      { id: user.id },
      env.ACCESS_TOKEN_SECRET,
      env.ACCESS_TOKEN_EXPIRY,
    );

    // rotate refresh token
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
    if (!user) throw new Error("User not found");

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      emailVerified: !!user.emailVerified,
      profileImageUrl: user.profileImageUrl ?? null,
    };
  }

  public async resendVerificationEmail(
    payload: ResendVerificationEmailInputModelType,
  ): Promise<ResendVerificationEmailOutputModelType> {
    const { userId } = payload;

    const user = await this.getUserById(userId);
    if (!user) throw new Error("User not found");

    // Generate a verification token/OTP and send it via email (TODO: email provider).
    // Example token (JWT):
    // const token = JWT.sign({ id: userId, purpose: "verify_email" }, env.ACCESS_TOKEN_SECRET, {
    //   expiresIn: env.ACCESS_TOKEN_EXPIRY as JWT.SignOptions["expiresIn"],
    // });

    return { success: true };
  }

  public async verifyEmail(
    payload: VerifyEmailInputModelType,
  ): Promise<VerifyEmailOutputModelType> {
    const { userId, token } = payload;

    // If you're using JWT tokens from resendVerificationEmail:
    const decoded = JWT.verify(token, env.ACCESS_TOKEN_SECRET) as unknown as {
      id?: string;
      purpose?: string;
    };

    if (decoded?.id !== userId || decoded?.purpose !== "verify_email") {
      throw new Error("Invalid verification token");
    }

    await db.update(usersTable).set({ emailVerified: true }).where(eq(usersTable.id, userId));

    return { success: true };
  }

  public async forgotPassword(
    payload: ForgotPasswordInputModelType,
  ): Promise<ForgotPasswordOutputModelType> {
    const { userId } = payload;

    const user = await this.getUserById(userId);
    if (!user) throw new Error("User not found");

    // Generate reset token/OTP and send it (TODO: email provider).
    // Example token (JWT):
    // const token = JWT.sign({ id: userId, purpose: "reset_password" }, env.ACCESS_TOKEN_SECRET, {
    //   expiresIn: env.ACCESS_TOKEN_EXPIRY as JWT.SignOptions["expiresIn"],
    // });

    return { success: true };
  }

  public async resetPassword(
    payload: ResetPasswordInputModelType,
  ): Promise<ResetPasswordOutputModelType> {
    const { userId, token, newPassword } = payload;

    const decoded = JWT.verify(token, env.ACCESS_TOKEN_SECRET) as unknown as {
      id?: string;
      purpose?: string;
    };

    if (decoded?.id !== userId || decoded?.purpose !== "reset_password") {
      throw new Error("Invalid reset token");
    }

    const salt = randomBytes(16).toString("hex");
    const hash = createHmac("sha256", salt).update(newPassword).digest("hex");

    await db
      .update(usersTable)
      .set({ password: hash, salt, refreshToken: null })
      .where(eq(usersTable.id, userId));

    return { success: true };
  }

  public async changePassword(
    payload: ChangePasswordInputModelType,
  ): Promise<ChangePasswordOutputModelType> {
    const { userId, currentPassword, newPassword } = payload;

    const user = await this.getUserById(userId);
    if (!user || !user.password || !user.salt) throw new Error("Invalid credentials");

    const currentHash = createHmac("sha256", user.salt).update(currentPassword).digest("hex");
    if (currentHash !== user.password) throw new Error("Invalid credentials");

    const newSalt = randomBytes(16).toString("hex");
    const newHash = createHmac("sha256", newSalt).update(newPassword).digest("hex");

    await db
      .update(usersTable)
      .set({ password: newHash, salt: newSalt, refreshToken: null })
      .where(eq(usersTable.id, userId));

    return { success: true };
  }
}

export default UserService;
