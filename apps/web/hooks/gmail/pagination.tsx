import { useEffect, useState } from "react";
import type { GmailMessageSummaryType } from "@repo/services/gmail/model";
import { trpc } from "~/trpc/client";

export type GmailFolder = "inbox" | "sent" | "draft" | "trash";

const PAGE_SIZE = 25;

export function useGmailMessagesPagination(folder: GmailFolder, q?: string) {
  const [pageToken, setPageToken] = useState<string | undefined>();
  const [messages, setMessages] = useState<GmailMessageSummaryType[]>([]);

  const input = { maxResults: PAGE_SIZE, pageToken, q };

  // Rules of hooks: all three called, only one enabled
  const inboxQuery = trpc.gmail.inbox.useQuery(input, { enabled: folder === "inbox" });
  const sentQuery = trpc.gmail.listSentMessages.useQuery(input, { enabled: folder === "sent" });
  const draftQuery = trpc.gmail.listDraftMessages.useQuery(input, { enabled: folder === "draft" });
  const trashQuery = trpc.gmail.listTrash.useQuery(input, { enabled: folder === "trash" });

  const query =
    folder === "inbox"
      ? inboxQuery
      : folder === "sent"
        ? sentQuery
        : folder === "draft"
          ? draftQuery
          : trashQuery;

  const { data, isPending, isFetching, isError, refetch } = query;

  // Reset when folder or search changes
  useEffect(() => {
    setPageToken(undefined);
    setMessages([]);
  }, [folder, q]);

  // Accumulate pages
  useEffect(() => {
    if (!data) return;
    setMessages((prev) => (pageToken ? [...prev, ...data.messages] : data.messages));
  }, [data, pageToken]);

  const hasMore = Boolean(data?.nextPageToken);

  function loadMore() {
    if (data?.nextPageToken && !isFetching) {
      setPageToken(data.nextPageToken);
    }
  }

  function markMessageReadLocally(id: string) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, unread: false } : m)));
  }

  function setMessageUnread(id: string, unread: boolean) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, unread } : m)));
  }
  function removeMessageLocally(id: string) {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }
  function restoreMessageLocally(message: GmailMessageSummaryType) {
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev;
      return [message, ...prev];
    });
  }
  return {
    messages,
    hasMore,
    loadMore,
    refetch,
    markMessageReadLocally,
    setMessageUnread,
    removeMessageLocally,
    restoreMessageLocally,
    isPending: isPending && messages.length === 0,
    isLoadingMore: isFetching && messages.length > 0,
    isError,
  };
}

// Optional alias so existing inbox code keeps working
export function useGmailInboxPagination(q?: string) {
  return useGmailMessagesPagination("inbox", q);
}
