import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "./env";
import { sql } from "drizzle-orm";

export const db = drizzle(env.DATABASE_URL);
export * from "drizzle-orm";
export default db;
export async function checkDatabaseConnection() {
  await db.execute(sql`select 1`);
}
