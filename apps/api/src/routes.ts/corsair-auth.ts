// apps/api/src/routes.ts/corsair-auth.ts
import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { logger } from "@repo/logger";
import db, { and, eq } from "@repo/database";
import { corsairAccounts, corsairIntegrations } from "@repo/database/schema";
import { corsair, pool } from "@repo/services/corsair";
import { generateOAuthUrl, processOAuthCallback } from "corsair/oauth";
import { createAccountKeyManager, createIntegrationKeyManager } from "corsair/core";
import { createCorsairDatabase } from "corsair/db";
import { env as serviceEnv } from "@repo/services/env";
import { env as apiEnv, env } from "../env";
import { calendarWatchChannels } from "@repo/database/schema";
import { buildCalendarChannelToken } from "@repo/services/webhooks/calendar-channeel";
export const corsairAuthRouter = Router();
import type { Request } from "express";
import * as JWT from "jsonwebtoken";
const ACCESS_COOKIE = "access_authentication-token"; // = AUTHENTICATION_COOKIE_NAME_ACCESS
function getTenantId(req: Request): string | null {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token) return null;
  try {
    const { id } = JWT.verify(token, serviceEnv.ACCESS_TOKEN_SECRET) as { id: string };
    return id;
  } catch {
    return null;
  }
}

const REDIRECT_URI = serviceEnv.CORSAIR_CONNECT_REDIRECT_URI;
const KEK = serviceEnv.CORSAIR_KEK;
const database = createCorsairDatabase(pool);

type GoogleTokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

type GoogleWatchResponse = {
  expiration?: string;
  historyId?: string;
  resourceId?: string;
  resourceUri?: string;
};

/** Exchange a stored refresh token for a fresh Google access token. */
async function refreshGoogleAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string | null> {
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

  if (!res.ok) {
    logger.error("Google token refresh failed", { body: await res.text() });
    return null;
  }

  const data = (await res.json()) as GoogleTokenResponse;
  return data.access_token;
}

/** Register a Gmail push-notification watch on the INBOX (requires a Pub/Sub topic). */
async function registerGmailWatch(tenantId: string) {
  const integrationKm = createIntegrationKeyManager({
    authType: "oauth_2",
    integrationName: "gmail",
    kek: KEK,
    database,
    extraIntegrationFields: ["topic_id"],
  });
  const accountKm = createAccountKeyManager({
    authType: "oauth_2",
    integrationName: "gmail",
    tenantId,
    kek: KEK,
    database,
  });

  const clientId = await integrationKm.get_client_id();
  const clientSecret = await integrationKm.get_client_secret();
  const refreshToken = await accountKm.get_refresh_token();
  const topicId =
    (await (integrationKm as { get_topic_id?: () => Promise<string | null> }).get_topic_id?.()) ??
    env.GMAIL_PUBSUB_TOPIC_ID;

  if (!clientId || !clientSecret || !refreshToken || !topicId) {
    logger.warn("Skipping Gmail watch: missing credentials", {
      clientId: !!clientId,
      clientSecret: !!clientSecret,
      refreshToken: !!refreshToken,
      topicId: !!topicId,
    });
    return;
  }

  const accessToken = await refreshGoogleAccessToken(clientId, clientSecret, refreshToken);
  if (!accessToken) return;

  const watchRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/watch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ topicName: topicId, labelIds: ["INBOX"] }),
  });

  if (!watchRes.ok) {
    logger.error("Gmail watch registration failed", { body: await watchRes.text() });
    return;
  }

  const watchData = (await watchRes.json()) as GoogleWatchResponse;
  logger.info("Gmail watch registered", {
    tenantId,
    expiration: watchData.expiration
      ? new Date(Number(watchData.expiration)).toISOString()
      : undefined,
  });
}

/**
 * Copy the Google tokens stored on the Gmail account onto a Google Calendar account
 * for the same tenant, creating the Calendar account row if it does not exist.
 * Only works if the Gmail consent screen also granted calendar scopes.
 */
async function duplicateGmailTokensToCalendar(tenantId: string): Promise<boolean> {
  const calendarIntegration = await db
    .select()
    .from(corsairIntegrations)
    .where(eq(corsairIntegrations.name, "googlecalendar"))
    .then((rows) => rows[0]);

  if (!calendarIntegration) return false;

  const gmailIntegration = await db
    .select()
    .from(corsairIntegrations)
    .where(eq(corsairIntegrations.name, "gmail"))
    .then((rows) => rows[0]);
  if (!gmailIntegration) return false;

  const gmailAccount = await db
    .select()
    .from(corsairAccounts)
    .where(
      and(
        eq(corsairAccounts.tenantId, tenantId),
        eq(corsairAccounts.integrationId, gmailIntegration.id),
      ),
    )
    .then((rows) => rows[0]);
  if (!gmailAccount) return false;

  // Create the Calendar account row inside a transaction to avoid duplicate races.
  await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(corsairAccounts)
      .where(
        and(
          eq(corsairAccounts.tenantId, tenantId),
          eq(corsairAccounts.integrationId, calendarIntegration.id),
        ),
      )
      .then((rows) => rows[0]);

    if (!existing) {
      await tx.insert(corsairAccounts).values({
        id: crypto.randomUUID(),
        tenantId,
        integrationId: calendarIntegration.id,
        config: {},
        dek: gmailAccount.dek,
      });
    }
  });

  const gmailAccountKm = createAccountKeyManager({
    authType: "oauth_2",
    integrationName: "gmail",
    tenantId,
    kek: KEK,
    database,
  });
  const calendarAccountKm = createAccountKeyManager({
    authType: "oauth_2",
    integrationName: "googlecalendar",
    tenantId,
    kek: KEK,
    database,
  });

  const accessToken = await gmailAccountKm.get_access_token();
  const refreshToken = await gmailAccountKm.get_refresh_token();
  const expiresAt = await gmailAccountKm.get_expires_at();

  if (accessToken) await calendarAccountKm.set_access_token(accessToken);
  if (refreshToken) await calendarAccountKm.set_refresh_token(refreshToken);
  if (expiresAt) await calendarAccountKm.set_expires_at(expiresAt);

  logger.info("Copied Google tokens from Gmail to Calendar account", { tenantId });
  return true;
}

/** Register a Google Calendar push-notification watch (needs a public HTTPS webhook URL). */
async function registerCalendarWatch(tenantId: string) {
  const integrationKm = createIntegrationKeyManager({
    authType: "oauth_2",
    integrationName: "googlecalendar",
    kek: KEK,
    database,
  });
  const accountKm = createAccountKeyManager({
    authType: "oauth_2",
    integrationName: "googlecalendar",
    tenantId,
    kek: KEK,
    database,
  });

  const clientId = await integrationKm.get_client_id();
  const clientSecret = await integrationKm.get_client_secret();
  const refreshToken = await accountKm.get_refresh_token();

  if (!clientId || !clientSecret || !refreshToken) {
    logger.warn("Skipping Calendar watch: missing credentials", {
      clientId: !!clientId,
      clientSecret: !!clientSecret,
      refreshToken: !!refreshToken,
    });
    return;
  }

  const accessToken = await refreshGoogleAccessToken(clientId, clientSecret, refreshToken);
  if (!accessToken) return;

  const channelId = crypto.randomUUID();
  const base = env.CORSAIR_WEBHOOK_BASE;

  if (!base?.startsWith("https://")) {
    logger.warn("Skipping Calendar watch: CORSAIR_WEBHOOK_BASE must be public HTTPS");
    return;
  }

  const webhookUrl = `${base}/webhooks/calendar?token=${env.CORSAIR_WEBHOOK_SECRET}`;
  const channelToken = buildCalendarChannelToken(tenantId, channelId, env.CORSAIR_WEBHOOK_SECRET);

  const watchRes = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events/watch",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: channelId,
        type: "web_hook",
        address: webhookUrl,
        token: channelToken,
      }),
    },
  );

  if (!watchRes.ok) {
    logger.error("Calendar watch registration failed", { body: await watchRes.text() });
    return;
  }

  const watchData = (await watchRes.json()) as GoogleWatchResponse;

  if (!watchData.resourceId) {
    logger.error("Calendar watch missing resourceId", { tenantId, channelId });
    return;
  }

  await db.insert(calendarWatchChannels).values({
    channelId,
    resourceId: watchData.resourceId,
    tenantId,
    expiresAt: watchData.expiration ? new Date(Number(watchData.expiration)) : null,
  });

  logger.info("Calendar watch registered", {
    tenantId,
    channelId,
    resourceId: watchData.resourceId,
    expiration: watchData.expiration
      ? new Date(Number(watchData.expiration)).toISOString()
      : undefined,
  });
}

// ---- Routes ----

// IMPORTANT: register /callback BEFORE /:plugin so it isn't captured as a plugin name.

// 2. OAuth callback: GET /connect/callback?code=...&state=...
corsairAuthRouter.get("/callback", async (req, res) => {
  const parsed = z
    .object({ code: z.string().min(1), state: z.string().min(1) })
    .safeParse(req.query);

  if (!parsed.success) {
    return res.redirect(
      `${apiEnv.CLIENT_URL}/onboarding?error=${encodeURIComponent(
        "Missing code or state parameter",
      )}`,
    );
  }

  try {
    const { plugin, tenantId } = await processOAuthCallback(corsair, {
      code: parsed.data.code,
      state: parsed.data.state,
      redirectUri: REDIRECT_URI,
    });

    logger.info("Corsair connected", { plugin, tenantId });

    // Side effects are best-effort: never fail the redirect because a watch call failed.
    if (plugin === "gmail") {
      try {
        await registerGmailWatch(tenantId);
        // if (await duplicateGmailTokensToCalendar(tenantId)) {
        //   await registerCalendarWatch(tenantId);
        // }
      } catch (err) {
        logger.error("Gmail post-connect setup failed", { err });
      }
    }

    if (plugin === "googlecalendar") {
      try {
        await registerCalendarWatch(tenantId);
      } catch (err) {
        logger.error("Calendar post-connect setup failed", { err });
      }
    }

    return res.redirect(`${apiEnv.CLIENT_URL}/onboarding`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed";
    logger.error("Corsair OAuth callback failed", { error });
    return res.redirect(`${apiEnv.CLIENT_URL}/onboarding?error=${encodeURIComponent(message)}`);
  }
});

// 1. Start a connection: GET /connect/:plugin?tenantId=...
// replace the existing /:plugin handler body
corsairAuthRouter.get("/:plugin", async (req, res) => {
  const plugin = req.params.plugin; // "gmail" | "googlecalendar"
  const tenantId = getTenantId(req);

  if (!tenantId) {
    return res.redirect(`${apiEnv.CLIENT_URL}/api-auth/login`);
  }

  try {
    const { url } = await generateOAuthUrl(corsair, plugin, {
      tenantId,
      redirectUri: REDIRECT_URI,
    });
    console.log("url", url);
    return res.redirect(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start connection";
    logger.error("generateOAuthUrl failed", { plugin, error });
    return res.status(400).json({ error: message });
  }
});
