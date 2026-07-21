import { Inngest } from "inngest";
import { env } from "../env";

export const inngest = new Inngest({
  id: "orion",
  eventKey: env.INNGEST_EVENT_KEY,
});

/** Local dev server or cloud event key configured. */
export function isInngestEnabled(): boolean {
  return env.INNGEST_DEV === "1" || Boolean(env.INNGEST_EVENT_KEY);
}
