import { Router, type Request } from "express";
import * as JWT from "jsonwebtoken";
import { env as serviceEnv } from "@repo/services/env";
import { sseHub } from "../sse/hub";

export const eventsRouter = Router();
const ACCESS_COOKIE = "access_authentication-token";

function getUserIdFromRequest(req: Request): string | null {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token) return null;
  try {
    const { id } = JWT.verify(token, serviceEnv.ACCESS_TOKEN_SECRET) as { id: string };
    return id;
  } catch {
    return null;
  }
}

eventsRouter.get("/stream", (req, res) => {
  const userId = getUserIdFromRequest(req);
  if (!userId) return res.status(401).end();

  sseHub.subscribe(userId, res);
});
