import { pickMutationState, pickQueryState } from "~/lib/constants";
import { trpc } from "~/trpc/client";

export const CHAT_MESSAGES_PAGE_SIZE = 30;

export const runAgent = () => pickMutationState(trpc.agent.runAgent.useMutation());
export const agentThreads = () => pickQueryState(trpc.agent.listThreads.useQuery());

export function agentThreadMessages(threadId: string | null) {
  const query = trpc.agent.threadMessages.useInfiniteQuery(
    { threadId: threadId!, limit: CHAT_MESSAGES_PAGE_SIZE },
    {
      enabled: threadId !== null,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    },
  );

  return {
    ...pickQueryState(query),
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  };
}
