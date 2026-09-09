export class FileSaveError extends Error {
  constructor(
    message: string,
    public readonly code: "BAD_REQUEST" | "INTERNAL_SERVER_ERROR" = "BAD_REQUEST",
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "FileSaveError";
  }
}

export const badRequest = (msg: string) => new FileSaveError(msg, "BAD_REQUEST");

export function normalizeFileSaveError(err: unknown): FileSaveError | Error {
  if (err instanceof FileSaveError) return err;
  if (err instanceof Error) return err;
  return new FileSaveError("Something went wrong", "INTERNAL_SERVER_ERROR", err);
}
