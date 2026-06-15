import { setupCorsair } from "corsair/setup";
import { createIntegrationKeyManager } from "corsair/core";
import { createCorsairDatabase } from "corsair/db";
import { corsair, pool } from "@repo/services/corsair";
import { env as serviceEnv } from "@repo/services/env";

const database = createCorsairDatabase(pool);

async function setIntegrationKeys(integrationName: "gmail" | "googlecalendar") {
  const km = createIntegrationKeyManager({
    authType: "oauth_2",
    integrationName,
    kek: serviceEnv.CORSAIR_KEK,
    database,
  });
  await km.set_client_id(serviceEnv.GOOGLE_OAUTH_CLIENT_ID);
  await km.set_client_secret(serviceEnv.GOOGLE_OAUTH_CLIENT_SECRET);
  console.log(`✓ ${integrationName} client credentials set`);
}

async function main() {
  // 1. Create corsair_integrations rows + DEKs for every configured plugin.
  console.log(await setupCorsair(corsair, { caller: "script" }));

  // 2. Store Google OAuth credentials (encrypted) for each plugin.
  await setIntegrationKeys("gmail");
  await setIntegrationKeys("googlecalendar");

  console.log("Corsair integrations configured.");
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
