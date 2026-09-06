import type { TRPC_ERROR_CODE_KEY } from "@trpc/server/rpc";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: TRPC_ERROR_CODE_KEY = "BAD_REQUEST",
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

// helpers
export const unauthorized = (msg = "Unauthorized") => new AppError(msg, "UNAUTHORIZED");

export const notFound = (msg = "Not found") => new AppError(msg, "NOT_FOUND");

export const conflict = (msg: string) => new AppError(msg, "CONFLICT");
export const badRequest = (msg: string) => new AppError(msg, "BAD_REQUEST");

export const internal = (msg = "Something went wrong") =>
  new AppError(msg, "INTERNAL_SERVER_ERROR");
export const tooManyRequests = (msg = "Too many requests") =>
  new AppError(msg, "TOO_MANY_REQUESTS");

const GOOGLE_ACCESS_DENIED_MSG =
  "Google access was denied. Open Connections in the header and reconnect Gmail or Calendar.";

export function httpStatusFromError(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const candidate = err as { status?: unknown; response?: { status?: unknown } };
  if (typeof candidate.status === "number") return candidate.status;
  if (typeof candidate.response?.status === "number") return candidate.response.status;
  return undefined;
}

/** Map Google/Corsair auth failures to a reconnect message. */
export function googleAccessDeniedMessage(err: unknown): string | null {
  const status = httpStatusFromError(err);
  if (status === 403 || status === 401) return GOOGLE_ACCESS_DENIED_MSG;
  if (err instanceof Error && err.message.toLowerCase().includes("forbidden")) {
    return GOOGLE_ACCESS_DENIED_MSG;
  }
  if (err instanceof Error && err.message.toLowerCase().includes("unauthorized")) {
    return GOOGLE_ACCESS_DENIED_MSG;
  }
  return null;
}

export function normalizeServiceError(err: unknown): AppError | Error {
  if (err instanceof AppError) return err;
  const denied = googleAccessDeniedMessage(err);
  if (denied) return new AppError(denied, "FORBIDDEN", err);
  if (err instanceof Error) return err;
  return new AppError("Something went wrong", "INTERNAL_SERVER_ERROR", err);
}
