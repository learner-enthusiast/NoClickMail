import { z } from "zod";

export const threadContextMessageModel = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

export type ThreadContextMessageModelType = z.infer<typeof threadContextMessageModel>;
