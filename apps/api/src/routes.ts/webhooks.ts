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
