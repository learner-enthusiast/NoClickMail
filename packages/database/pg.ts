import pg from "pg";

import { env } from "./env";

/** Hosted Postgres (Neon, Supabase, etc.) needs SSL. */
export function isHostedPostgres(connectionString: string) {
  return (
    connectionString.includes("neon.tech") ||
    connectionString.includes("supabase.com") ||
    connectionString.includes("pooler.")
  );
}

/** @deprecated use isHostedPostgres */
export function isNeonDatabase(connectionString: string) {
  return isHostedPostgres(connectionString);
}

export function pgConnectionConfig(connectionString: string): pg.ClientConfig {
  const config: pg.ClientConfig = { connectionString };

  if (
    isHostedPostgres(connectionString) ||
    /sslmode=(require|verify-full|verify-ca)/i.test(connectionString)
  ) {
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
}

/** Prefer Neon direct (non-pooler) URL for drizzle-kit / journal migrations. */

export function createPgPool(connectionString = env.DATABASE_URL) {
  return new pg.Pool({
    ...pgConnectionConfig(connectionString),
    max: isHostedPostgres(connectionString) ? 5 : 10,
  });
}

export async function createPgClient(connectionString?: string) {
  const url = connectionString ?? env.DATABASE_URL;
  const client = new pg.Client(pgConnectionConfig(url));
  await client.connect();
  return client;
}
