import { httpBatchStreamLink } from "@repo/trpc/client";
import { agentAbort } from "~/lib/agent-abort";
import { env } from "~/env.js";

function getCsrfToken(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

export const createTRPCHttpBatchClientClient = () =>
  httpBatchStreamLink({
    url: env.NEXT_PUBLIC_API_URL ?? "/trpc",
    streamHeader: "accept",
    headers() {
      const csrf = getCsrfToken();
      return csrf ? { "x-csrf-token": csrf } : {};
    },
    fetch(url, options) {
      return fetch(url, {
        ...options,
        credentials: "include",
        signal: agentAbort.signal() ?? options?.signal,
      });
    },
  });
