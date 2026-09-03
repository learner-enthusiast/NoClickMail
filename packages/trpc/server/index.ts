import { router } from "./trpc";

import { healthRouter } from "./routes/health/route";
import { authRouter } from "./routes/auth/route";
import { connectionsRouter } from "./routes/connections/route";
import { gmailRouter } from "./routes/gmail/route";
import { calendarRouter } from "./routes/calendar/route";
import { agentsRouter } from "./routes/agent/route";

export const serverRouter = router({
  health: healthRouter,
  auth: authRouter,
  connections: connectionsRouter,
  gmail: gmailRouter,
  calendar: calendarRouter,
  agent: agentsRouter,
});

export { createContext } from "./context";
export type ServerRouter = typeof serverRouter;
