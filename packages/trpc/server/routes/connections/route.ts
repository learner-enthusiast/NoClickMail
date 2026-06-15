import { z } from "zod";
import { getCorsairConnectionStatus } from "@repo/services/corsair";
import { authenticatedProcedure, router } from "../../trpc";
import { zodUndefinedModel } from "../../schema";
import { generatePath } from "../../utils/path-generator";

const TAGS = ["Connections"];
const getPath = generatePath("/connections");

export const connectionsRouter = router({
  status: authenticatedProcedure
    .meta({ openapi: { method: "GET", path: getPath("/status"), tags: TAGS } })
    .input(zodUndefinedModel)
    .output(z.object({ gmail: z.boolean(), googlecalendar: z.boolean() }))
    .query(({ ctx }) => getCorsairConnectionStatus(ctx.user)),
});
