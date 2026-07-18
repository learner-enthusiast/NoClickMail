import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { env } from "./env";
import { getMigrateDatabaseUrl, redactDatabaseUrl } from "./migrate-url";

const migrateUrl = getMigrateDatabaseUrl(env.DATABASE_URL_DIRECT, env.DATABASE_URL);
console.log("drizzle migrate target:", redactDatabaseUrl(migrateUrl));

export default defineConfig({
  out: "./drizzle",
  schema: "./schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: migrateUrl,
  },
});
