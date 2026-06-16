import { Router } from "express";
import { logger } from "@repo/logger";
import { env as apiEnv } from "../env";

export const webhookRouter = Router();

type PubSubPushBody = {
  message?: { data?: string; messageId?: string; publishTime?: string };
  subscription?: string;
};

type GmailNotification = { emailAddress: string; historyId: number | string };

webhookRouter.post("/corsair", async (req, res) => {
  // 1. Verify the push really came from you (shared secret in the URL).
  if (apiEnv.CORSAIR_WEBHOOK_SECRET && req.query.token !== apiEnv.CORSAIR_WEBHOOK_SECRET) {
    return res.status(401).end();
  }

  // 2. ACK immediately — any non-2xx makes Pub/Sub redeliver.
  res.status(204).end();

  // 3. Decode the envelope → Gmail notification, then process out-of-band.
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

    // TODO: look up tenant by decoded.emailAddress, then call Gmail
    // history.list(startHistoryId) with that account's token to fetch changes.
  } catch (err) {
    logger.error("Failed to process Gmail push", { err });
  }
});
// apps/api/src/routes.ts/webhooks.ts — add below the /corsair handler

// Google Calendar push notifications: data is in X-Goog-* headers, body is empty.
webhookRouter.post("/calendar", async (req, res) => {
  const channelId = req.header("x-goog-channel-id");
  const resourceState = req.header("x-goog-resource-state"); // "sync" | "exists" | "not_exists"
  const resourceId = req.header("x-goog-resource-id");
  const messageNumber = req.header("x-goog-message-number");
  const tenantId = req.header("x-goog-channel-token"); // we set token=tenantId on watch()

  // ACK immediately — Google retries on any non-2xx.
  res.status(200).end();

  // The first notification right after watch() is a handshake — just acknowledge it.
  if (resourceState === "sync") {
    logger.info("Calendar channel established", { channelId, resourceId });
    return;
  }

  if (!tenantId) {
    logger.warn("Calendar push missing tenant token", { channelId });
    return;
  }

  // Notifications don't say WHAT changed — do an incremental sync per tenant.
  try {
    logger.info("Calendar change received", {
      tenantId,
      channelId,
      resourceState,
      messageNumber,
    });

    // TODO: await calendarService.syncEvents(tenantId)
    //   - fetch events with the stored syncToken (events.getMany({ syncToken }))
    //   - persist changes + the new nextSyncToken
  } catch (err) {
    logger.error("Failed to process Calendar push", { err });
  }
});
