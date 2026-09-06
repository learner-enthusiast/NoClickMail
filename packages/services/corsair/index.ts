// packages/services/corsair/index.ts
import { createCorsair } from "corsair";
import { gmail } from "@corsair-dev/gmail";
import { googlecalendar } from "@corsair-dev/googlecalendar";
import { env } from "../env";
import { sanitizeGmailRawMessage } from "./gmail-raw";
import { ensureOAuthAccessToken } from "./oauth";
import type { OAuthIntegrationName } from "./oauth";
import { corsairDatabase, pool } from "./shared";

export { ensureOAuthAccessToken } from "./oauth";
export type { OAuthIntegrationName } from "./oauth";
export { corsairDatabase, pool } from "./shared";

export const corsair = createCorsair({
  database: pool,
  kek: env.CORSAIR_KEK,
  multiTenancy: true,
  plugins: [gmail({ authType: "oauth_2" }), googlecalendar({ authType: "oauth_2" })],
});

const gmailSendPatched = Symbol("gmailSendPatched");

type GmailSendInput = { raw?: string; threadId?: string; userId?: string };

function patchGmailSend(tenant: ReturnType<typeof corsair.withTenant>) {
  const messages = tenant.gmail?.api?.messages as
    | ({ send: (input: GmailSendInput) => Promise<unknown> } & Record<symbol, boolean>)
    | undefined;

  if (!messages?.send || messages[gmailSendPatched]) return;

  const originalSend = messages.send.bind(messages);
  messages.send = async (input: GmailSendInput) => {
    if (typeof input.raw === "string") {
      return originalSend({ ...input, raw: sanitizeGmailRawMessage(input.raw) });
    }
    return originalSend(input);
  };
  messages[gmailSendPatched] = true;
}

function getCorsairTenant(tenantId: string) {
  const tenant = corsair.withTenant(tenantId);
  patchGmailSend(tenant);
  return tenant;
}

/** Tenant-scoped Corsair client with Gmail send sanitization applied. */
export function withCorsairTenant(tenantId: string) {
  return getCorsairTenant(tenantId);
}

async function isPluginConnectionUsable(
  tenantId: string,
  plugin: OAuthIntegrationName,
  corsairStatus: string | undefined,
): Promise<boolean> {
  if (corsairStatus !== "connected") return false;
  return ensureOAuthAccessToken(tenantId, plugin);
}

export async function getCorsairConnectionStatus(tenantId: string) {
  const status = await corsair.manage.connectionStatus.get({ tenantId });

  const [gmail, googlecalendar] = await Promise.all([
    isPluginConnectionUsable(tenantId, "gmail", status.gmail),
    isPluginConnectionUsable(tenantId, "googlecalendar", status.googlecalendar),
  ]);

  return { gmail, googlecalendar };
}
