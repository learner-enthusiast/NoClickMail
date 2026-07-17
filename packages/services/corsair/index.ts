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

export async function getCorsairConnectionStatus(tenantId: string) {
  const status = await corsair.manage.connectionStatus.get({
    tenantId,
  });

  return {
    gmail: status.gmail === "connected",
    googlecalendar: status.googlecalendar === "connected",
  };
}
