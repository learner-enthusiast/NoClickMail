import { Router } from "express";
import { logger } from "@repo/logger";
import { env as apiEnv } from "../env";
import db, { eq } from "@repo/database";
import { calendarWatchChannels, usersTable } from "@repo/database/schema";
import { verifyPubSubPush } from "@repo/services/webhooks/verify-pubsub";
import { verifyCalendarChannelToken } from "@repo/services/webhooks/calendar-channeel";
import { sseHub } from "../sse/hub";

export const webhookRouter = Router();

type PubSubPushBody = {
  message?: { data?: string; messageId?: string; publishTime?: string };
  subscription?: string;
};

type GmailNotification = { emailAddress: string; historyId: number | string };

function rejectWebhook(res: { status: (code: number) => { end: () => void } }) {
  return res.status(401).end();
}

function hasValidWebhookSecret(queryToken: unknown): boolean {
  return typeof queryToken === "string" && queryToken === apiEnv.CORSAIR_WEBHOOK_SECRET;
}

// Gmail via Pub/Sub push
webhookRouter.post("/corsair", async (req, res) => {
  if (!hasValidWebhookSecret(req.query.token)) {
    return rejectWebhook(res);
  }

  const audience = `${apiEnv.CORSAIR_WEBHOOK_BASE}/webhooks/corsair?token=${apiEnv.CORSAIR_WEBHOOK_SECRET}`;
  const ok = await verifyPubSubPush(req, audience);
  if (!ok) return rejectWebhook(res);

  // ACK before slow work — Pub/Sub retries on non-2xx
  res.status(204).end();

  try {
    const body = req.body as PubSubPushBody;
    if (!body?.message?.data) return;

    const decoded = JSON.parse(
      Buffer.from(body.message.data, "base64").toString("utf8"),
    ) as GmailNotification;

    logger.info("Gmail push received", {
      emailAddress: decoded.emailAddress,
      historyId: decoded.historyId,
      messageId: body.message.messageId,
    });

    const email = decoded.emailAddress?.trim().toLowerCase();
    if (!email) {
      logger.warn("Gmail push missing emailAddress");
      return;
    }

    const [user] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (!user) {
      logger.warn("Gmail push: no user for email", { emailAddress: decoded.emailAddress });
      return;
    }

    sseHub.notify(user.id, {
      type: "gmail.inbox.changed",
      historyId: String(decoded.historyId),
    });
  } catch (err) {
    logger.error("Failed to process Gmail push", { err });
  }
});

// Google Calendar push — direct HTTPS webhook
webhookRouter.post("/calendar", async (req, res) => {
  if (!hasValidWebhookSecret(req.query.token)) {
    return rejectWebhook(res);
  }

  const channelId = req.header("x-goog-channel-id");
  const resourceState = req.header("x-goog-resource-state");
  const resourceId = req.header("x-goog-resource-id");
  const messageNumber = req.header("x-goog-message-number");
  const channelToken = req.header("x-goog-channel-token");

  // Handshake — Google sends this right after watch()
  if (resourceState === "sync") {
    res.status(200).end();
    logger.info("Calendar channel established", { channelId, resourceId });
    return;
  }

  if (!channelId || !resourceId) {
    logger.warn("Calendar push missing channel headers", { channelId, resourceId });
    return res.status(200).end();
  }

  const [watch] = await db
    .select()
    .from(calendarWatchChannels)
    .where(eq(calendarWatchChannels.channelId, channelId))
    .limit(1);

  if (!watch || watch.resourceId !== resourceId) {
    logger.warn("Calendar push unknown or stale channel", { channelId, resourceId });
    return res.status(200).end();
  }

  const tenantId = verifyCalendarChannelToken(
    channelToken,
    channelId,
    apiEnv.CORSAIR_WEBHOOK_SECRET,
  );

  if (!tenantId || tenantId !== watch.tenantId) {
    logger.warn("Calendar push invalid channel token", { channelId });
    return res.status(200).end();
  }

  res.status(200).end();

  try {
    logger.info("Calendar change received", {
      tenantId,
      channelId,
      resourceState,
      messageNumber,
    });

    sseHub.notify(tenantId, {
      type: "calendar.events.changed",
      calendarId: "primary",
    });
  } catch (err) {
    logger.error("Failed to process Calendar push", { err });
  }
});
