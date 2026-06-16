import { pickMutationState } from "~/lib/constants";
import { trpc } from "~/trpc/client";

export const runAgent = () => pickMutationState(trpc.agent.runAgent.useMutation());
