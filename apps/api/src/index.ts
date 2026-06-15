import http from "node:http";
import { logger } from "@repo/logger";
import { app as expressApplication } from "./server";

import { env } from "./env";
import { checkDatabaseConnection } from "@repo/database";

async function init() {
  try {
    await checkDatabaseConnection();
    logger.info("database connection OK");
    const server = http.createServer(expressApplication);
    const PORT: number = env.PORT ? +env.PORT : 8000;
    server.listen(PORT, () => {
      logger.info(`http server is running on PORT ${PORT}`);
    });
  } catch (err) {
    logger.error("Startup failed (database unreachable?)", { err });
    process.exit(1);
  }
}

init();
