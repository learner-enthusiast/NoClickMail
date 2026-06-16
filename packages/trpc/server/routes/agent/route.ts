import z from "zod";
import { authenticatedProcedure, router } from "../../trpc";
import { generatePath } from "../../utils/path-generator";
import { CorsairAgent } from "../../services";

const TAGS = ["Agent"];
const getPath = generatePath("/agent");

export const agentsRouter = router({
  runAgent: authenticatedProcedure
    .meta({ openapi: { method: "POST", path: getPath("/run"), tags: TAGS } })
    .input(z.object({ prompt: z.string().min(1) }))
    .output(z.object({ output: z.string() }))
    .mutation(async ({ ctx, input }) => ({
      output: (await new CorsairAgent(ctx.user).executePrompt(input.prompt)) ?? "",
    })),
});
