/** Shared AbortController for in-flight agent.runAgent tRPC requests. */
let controller: AbortController | null = null;

export const agentAbort = {
  set(next: AbortController | null) {
    controller = next;
  },
  signal(): AbortSignal | undefined {
    return controller?.signal;
  },
  abort() {
    controller?.abort();
    controller = null;
  },
};

export function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && error.name === "AbortError") return true;
  if (error && typeof error === "object" && "data" in error) {
    const code = (error as { data?: { code?: string } }).data?.code;
    if (code === "CLIENT_CLOSED_REQUEST") return true;
  }
  return false;
}
