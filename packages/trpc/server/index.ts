import { router } from "./trpc";

import { healthRouter } from "./routes/health/route";
import { authRouter } from "./routes/auth/route";
import { connectionsRouter } from "./routes/connections/route";

export const serverRouter = router({
  health: healthRouter,
  auth: authRouter,
  connections: connectionsRouter,
});

export { createContext } from "./context";
export type ServerRouter = typeof serverRouter;
