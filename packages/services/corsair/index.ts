// packages/services/corsair/index.ts
import { createCorsair } from "corsair";
import { createCorsairDatabase } from "corsair/db";
import { gmail } from "@corsair-dev/gmail";
import { googlecalendar } from "@corsair-dev/googlecalendar";
import { createPgPool } from "@repo/database/pg";
import { env } from "../env";

export const pool = createPgPool();
export const corsairDatabase = createCorsairDatabase(pool);

export const corsair = createCorsair({
  database: pool,
  kek: env.CORSAIR_KEK,
  multiTenancy: true,
  plugins: [gmail({ authType: "oauth_2" }), googlecalendar({ authType: "oauth_2" })],
});
import db, { eq } from "@repo/database";
import { corsairAccounts, corsairIntegrations } from "@repo/database/schema";

export async function getCorsairConnectionStatus(tenantId: string) {
  const rows = await db
    .select({ name: corsairIntegrations.name })
    .from(corsairAccounts)
    .innerJoin(corsairIntegrations, eq(corsairAccounts.integrationId, corsairIntegrations.id))
    .where(eq(corsairAccounts.tenantId, tenantId));

  const connected = new Set(rows.map((r) => r.name));
  return {
    gmail: connected.has("gmail"),
    googlecalendar: connected.has("googlecalendar"),
  };
}
