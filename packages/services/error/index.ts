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
