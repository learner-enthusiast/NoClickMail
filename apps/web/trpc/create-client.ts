import { httpBatchLink, httpBatchStreamLink, splitLink } from "@repo/trpc/client";
import { agentAbort } from "~/lib/agent-abort";
import { env } from "~/env.js";

function getCsrfToken(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

const trpcUrl = env.NEXT_PUBLIC_API_URL ?? "/trpc";

const sharedLinkOptions = {
  url: trpcUrl,
  headers() {
    const csrf = getCsrfToken();
    return csrf ? { "x-csrf-token": csrf } : {};
  },
  fetch(url: RequestInfo | URL, options?: RequestInit) {
    return fetch(url, {
      ...options,
      credentials: "include",
      signal: agentAbort.signal() ?? options?.signal,
    });
  },
};

/** Streaming responses send headers before the procedure finishes — cookies cannot be set/cleared on those requests. */
function usesStreamingLink(op: { type: string; path: string }) {
  return op.type === "query" || op.path === "agent.runAgent";
}

export const createTRPCHttpBatchClientClient = () =>
  splitLink({
    condition: usesStreamingLink,
    true: httpBatchStreamLink({
      ...sharedLinkOptions,
      streamHeader: "accept",
    }),
    false: httpBatchLink(sharedLinkOptions),
  });
