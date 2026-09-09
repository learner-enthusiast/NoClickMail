import { createCorsairDatabase } from "corsair/db";
import { createPgPool } from "@repo/database/pg";

export const pool = createPgPool();
export const corsairDatabase = createCorsairDatabase(pool);
