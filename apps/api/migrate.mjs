import fs from "node:fs";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(__dirname, "../../packages/database/drizzle");

function withHostedPostgresSsl(connectionString) {
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

function redactDatabaseUrl(connectionString) {
  try {
    const url = new URL(connectionString.replace(/^postgresql:/, "http:"));
    return `${url.hostname}:${url.port || "5432"}${url.pathname}`;
  } catch {
    return "(invalid database url)";
  }
}

function log(message) {
  console.log(`[migrate] ${message}`);
}

function fail(message, error) {
  console.error(`[migrate] ERROR: ${message}`);
  if (error) {
    console.error(error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
  }
  process.exit(1);
}

log(`node ${process.version}`);
log(`script: ${import.meta.url}`);
log(`migrations folder: ${migrationsFolder}`);

if (!fs.existsSync(migrationsFolder)) {
  fail(`migrations folder does not exist: ${migrationsFolder}`);
}

const journalPath = path.join(migrationsFolder, "meta/_journal.json");
if (!fs.existsSync(journalPath)) {
  fail(`migration journal missing: ${journalPath}`);
}

const sqlFiles = fs.readdirSync(migrationsFolder).filter((f) => f.endsWith(".sql"));
log(`found ${sqlFiles.length} SQL migration file(s): ${sqlFiles.join(", ")}`);

const rawUrl = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL ?? "";
if (!rawUrl) {
  fail("DATABASE_URL (or DATABASE_URL_DIRECT) is required for migrations");
}

const connectionString = withHostedPostgresSsl(rawUrl);
log(`database target: ${redactDatabaseUrl(connectionString)}`);
log(`using ${process.env.DATABASE_URL_DIRECT ? "DATABASE_URL_DIRECT" : "DATABASE_URL"}`);

const pool = new pg.Pool({ connectionString });
const db = drizzle(pool);

try {
  log("testing database connection...");
  const client = await pool.connect();
  const result = await client.query("SELECT current_database() AS db, current_user AS user");
  log(`connected as ${result.rows[0]?.user} to database ${result.rows[0]?.db}`);
  client.release();

  log("running drizzle migrations...");
  await migrate(db, { migrationsFolder });
  log("database migrations complete.");
} catch (error) {
  fail("migration failed", error);
} finally {
  await pool.end();
}
