import { httpBatchLink } from "@repo/trpc/client";
import { env } from "~/env.js";

export const createTRPCHttpBatchClient = () =>
  httpBatchLink({
    url: env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/trpc",
  });
