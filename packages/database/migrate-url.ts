/** Connection string for drizzle-kit migrate (prefer direct/session, not txn pooler). */
export function getMigrateDatabaseUrl(
  directUrl?: string,
  fallbackUrl?: string,
): string {
  const raw = directUrl ?? fallbackUrl ?? process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL (or DATABASE_URL_DIRECT) is required for migrations");
  }
  return withHostedPostgresSsl(raw);
}

/** Supabase/Neon require TLS; drizzle-kit passes the URL straight to pg. */
export function withHostedPostgresSsl(connectionString: string): string {
  const needsSsl =
    connectionString.includes("supabase.com") ||
    connectionString.includes("neon.tech") ||
    connectionString.includes("pooler.");

  if (!needsSsl || /sslmode=/i.test(connectionString)) {
    return connectionString;
  }

  const sep = connectionString.includes("?") ? "&" : "?";
  return `${connectionString}${sep}sslmode=require`;
}

/** Log-safe host for migrate output (never log credentials). */
export function redactDatabaseUrl(connectionString: string): string {
  try {
    const url = new URL(connectionString.replace(/^postgresql:/, "http:"));
    return `${url.hostname}:${url.port || "5432"}${url.pathname}`;
  } catch {
    return "(invalid database url)";
  }
}
