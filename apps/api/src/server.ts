import express from "express";
import { logger } from "@repo/logger";
import cors from "cors";
import cookieParser from "cookie-parser";

import * as trpcExpress from "@trpc/server/adapters/express";
import { generateOpenApiDocument, createOpenApiExpressMiddleware } from "trpc-to-openapi";
import { apiReference } from "@scalar/express-api-reference";

import { serverRouter, createContext } from "@repo/trpc/server";
import helmet from "helmet";
import { env } from "./env";
import { googleAuthRouter } from "./routes.ts/google-auth";
import { corsairAuthRouter } from "./routes.ts/corsair-auth";
import { webhookRouter } from "./routes.ts/webhooks";
import { eventsRouter } from "./routes.ts/events";
import { apiLimiter } from "./middleware/rate-limit";

export const app = express();
const openApiDocument = generateOpenApiDocument(serverRouter, {
  title: "Streamyst OpenAPI",
  version: "1.0.0",
  baseUrl: env.BASE_URL.concat("/api"),
});

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);

app.use(
  helmet({
    contentSecurityPolicy: false,

    crossOriginEmbedderPolicy: false,

    referrerPolicy: {
      policy: "strict-origin-when-cross-origin",
    },

    hsts:
      env.NODE_ENV === "production" || env.NODE_ENV === "prod"
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          }
        : false,
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    logger.info(`${req.method} ${req.originalUrl} -> ${res.statusCode}`, {
      durationMs: Date.now() - start,
    });
  });

  next();
});
app.get("/", (req, res) => {
  return res.json({ message: "Streamyst is up and running..." });
});

app.get("/health", (req, res) => {
  return res.json({ message: "Streamyst server is healthy", healthy: true });
});

logger.debug(`openapi.json: ${env.BASE_URL}/openapi.json`);
app.get("/openapi.json", (req, res) => {
  return res.json(openApiDocument);
});

logger.debug(`docs: ${env.BASE_URL}/docs`);
app.use("/docs", apiReference({ url: "/openapi.json" }));
app.use("/auth", googleAuthRouter);
app.use("/connect", corsairAuthRouter);
app.use("/webhooks", webhookRouter);
app.use("/events", eventsRouter);
app.use(
  "/api",
  apiLimiter,
  createOpenApiExpressMiddleware({
    router: serverRouter,
    createContext,
  }),
);

app.use(
  "/trpc",
  apiLimiter,
  trpcExpress.createExpressMiddleware({
    router: serverRouter,
    createContext,
    onError({ error, path, type, ctx, req }) {
      logger.error("tRPC error", {
        path,
        type,
        code: error.code,
        message: error.message,
        userId: "user" in (ctx as object) ? (ctx as { user?: string }).user : undefined,
        method: req.method,
        url: req.url,
      });
    },
  }),
);

export default app;
