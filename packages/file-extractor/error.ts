export class FileExtractError extends Error {
  constructor(
    message: string,
    public readonly code: "BAD_REQUEST" | "INTERNAL_SERVER_ERROR" = "BAD_REQUEST",
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "FileExtractError";
  }
}

export const badRequest = (msg: string) => new FileExtractError(msg, "BAD_REQUEST");

export function normalizeFileExtractError(err: unknown): FileExtractError | Error {
  if (err instanceof FileExtractError) return err;
  if (err instanceof Error) return err;
  return new FileExtractError("Something went wrong", "INTERNAL_SERVER_ERROR", err);
}
