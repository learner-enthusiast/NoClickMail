import { createAccountKeyManager, createIntegrationKeyManager } from "corsair/core";
import { env } from "../env";
import { corsairDatabase } from "./shared";

/** Match Corsair Gmail plugin refresh buffer (5 minutes). */
const TOKEN_REFRESH_BUFFER_SEC = 300;

export type OAuthIntegrationName = "gmail" | "googlecalendar";

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
};

function accountKeyManager(tenantId: string, integrationName: OAuthIntegrationName) {
  return createAccountKeyManager({
    authType: "oauth_2",
    integrationName,
    tenantId,
    kek: env.CORSAIR_KEK,
    database: corsairDatabase,
  });
}

function integrationKeyManager(integrationName: OAuthIntegrationName) {
  return createIntegrationKeyManager({
    authType: "oauth_2",
    integrationName,
    kek: env.CORSAIR_KEK,
    database: corsairDatabase,
  });
}

function isAccessTokenExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return true;
  const expiresAtSec = Number(expiresAt);
  if (!Number.isFinite(expiresAtSec)) return true;
  const nowSec = Math.floor(Date.now() / 1000);
  return expiresAtSec <= nowSec + TOKEN_REFRESH_BUFFER_SEC;
}

async function refreshGoogleAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<GoogleTokenResponse | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) return null;
  return (await res.json()) as GoogleTokenResponse;
}

/** Refresh and persist Google OAuth tokens when access token is expired or near expiry. */
export async function ensureOAuthAccessToken(
  tenantId: string,
  integrationName: OAuthIntegrationName,
): Promise<boolean> {
  const accountKm = accountKeyManager(tenantId, integrationName);

  let refreshToken: string | null;
  let expiresAt: string | null;

  try {
    refreshToken = await accountKm.get_refresh_token();
    expiresAt = await accountKm.get_expires_at();
  } catch {
    return false;
  }

  if (!refreshToken) return false;
  if (!isAccessTokenExpired(expiresAt)) return true;

  const integrationKm = integrationKeyManager(integrationName);
  const clientId = await integrationKm.get_client_id();
  const clientSecret = await integrationKm.get_client_secret();
  if (!clientId || !clientSecret) return false;

  const tokens = await refreshGoogleAccessToken(clientId, clientSecret, refreshToken);
  if (!tokens?.access_token) return false;

  await accountKm.set_access_token(tokens.access_token);
  if (tokens.refresh_token) {
    await accountKm.set_refresh_token(tokens.refresh_token);
  }
  if (tokens.expires_in) {
    await accountKm.set_expires_at(String(Math.floor(Date.now() / 1000) + tokens.expires_in));
  }

  return true;
}
