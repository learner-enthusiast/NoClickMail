import { RouterInputs } from "@repo/trpc/client";
import { pickMutationState, pickQueryState } from "~/lib/constants";
import { trpc } from "~/trpc/client";

export const runAgent = () => pickMutationState(trpc.agent.runAgent.useMutation());
export const agentThreads = () => pickQueryState(trpc.agent.listThreads.useQuery());
export const agentThreadMessages = (input: RouterInputs["agent"]["threadMessages"]) =>
  pickQueryState(trpc.agent.threadMessages.useQuery(input));
