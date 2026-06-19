import { env } from "~/env.js";

export const API_BASE = (env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/trpc").replace(
  /\/trpc\/?$/,
  "",
);

export type ConnectionProvider = "gmail" | "googlecalendar";

export function connectProvider(plugin: ConnectionProvider) {
  window.location.href = `${API_BASE}/connect/${plugin}`;
}
