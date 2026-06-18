import { TRPCError } from "@trpc/server";
import { AppError } from "@repo/services/error";

type ApiErrorLike = {
  code?: number | string;
  status?: number;
  response?: { status?: number };
  message?: string;
};

function codeFromApiError(err: ApiErrorLike): TRPCError["code"] | undefined {
  const status =
    err.status ?? err.response?.status ?? (typeof err.code === "number" ? err.code : undefined);

  if (status === 404) return "NOT_FOUND";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 429) return "TOO_MANY_REQUESTS";
  if (status && status >= 400 && status < 500) return "BAD_REQUEST";
  return undefined;
}

function codeFromMessage(message: string): TRPCError["code"] | undefined {
  const lower = message.toLowerCase();
  if (lower.includes("not found") || lower.includes("status code 404")) return "NOT_FOUND";
  if (
    lower.includes("unauthorized") ||
    lower.includes("invalid_grant") ||
    lower.includes("status code 401")
  )
    return "UNAUTHORIZED";
  if (lower.includes("forbidden") || lower.includes("status code 403")) return "FORBIDDEN";
  if (lower.includes("status code 429") || lower.includes("rate limit")) return "TOO_MANY_REQUESTS";
  if (lower.includes("status code 4")) return "BAD_REQUEST";
  return undefined;
}

export function toTRPCError(err: unknown): TRPCError {
  if (err instanceof TRPCError) return err;

  if (err instanceof AppError) {
    return new TRPCError({ code: err.code, message: err.message, cause: err.cause });
  }

  if (err && typeof err === "object") {
    const apiCode = codeFromApiError(err as ApiErrorLike);
    if (apiCode) {
      const message = (err as ApiErrorLike).message ?? "Request failed";
      return new TRPCError({ code: apiCode, message, cause: err });
    }
  }

  if (err instanceof Error) {
    const code = codeFromMessage(err.message) ?? "INTERNAL_SERVER_ERROR";
    const message =
      code === "INTERNAL_SERVER_ERROR" && process.env.NODE_ENV === "production"
        ? "Something went wrong"
        : err.message;
    return new TRPCError({ code, message, cause: err });
  }

  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Something went wrong" });
}
