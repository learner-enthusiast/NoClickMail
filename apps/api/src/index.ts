import http from "node:http";
import { logger } from "@repo/logger";
import { app as expressApplication } from "./server";

import { env } from "./env";
import { checkDatabaseConnection } from "@repo/database";

const DB_HEALTH_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DB_RETRY_INTERVAL_MS = 30_000; // retry every 30s while down
function startDatabaseHealthCheck() {
  const scheduleNext = (delayMs: number) => {
    setTimeout(runCheck, delayMs);
  };
  const runCheck = async () => {
    try {
      await checkDatabaseConnection();
      logger.debug("database connection OK");
      scheduleNext(DB_HEALTH_CHECK_INTERVAL_MS);
    } catch (err) {
      logger.error("Database health check failed, retrying...", { err });
      scheduleNext(DB_RETRY_INTERVAL_MS);
    }
  };
  scheduleNext(DB_HEALTH_CHECK_INTERVAL_MS);
}
async function init() {
  try {
    await checkDatabaseConnection();
    logger.info("database connection OK");
    const server = http.createServer(expressApplication);
    const PORT: number = env.PORT ? +env.PORT : 8000;
    server.listen(PORT, () => {
      logger.info(`http server is running on PORT ${PORT}`);
      startDatabaseHealthCheck();
    });
  } catch (err) {
    logger.error("Startup failed (database unreachable?)", { err });
    process.exit(1);
  }
}

init();
