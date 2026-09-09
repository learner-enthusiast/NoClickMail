import { createHmac } from "node:crypto";

export function buildCalendarChannelToken(
  tenantId: string,
  channelId: string,
  secret: string,
): string {
  const sig = createHmac("sha256", secret).update(`${tenantId}:${channelId}`).digest("hex");
  return `${tenantId}.${sig}`;
}

export function verifyCalendarChannelToken(
  token: string | undefined,
  channelId: string,
  secret: string,
): string | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;

  const tenantId = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(`${tenantId}:${channelId}`).digest("hex");

  return sig === expected ? tenantId : null;
}
