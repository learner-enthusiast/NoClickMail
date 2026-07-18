import { useEffect, useState } from "react";
import type { GmailMessageSummaryType } from "@repo/services/gmail/model";
import { trpc } from "~/trpc/client";

export type GmailFolder = "inbox" | "sent" | "draft" | "trash";

/** UI tabs: "primary" uses inbox API; the rest use listByCategory */
export type GmailCategory =
  | "primary"
  | "primary_unread"
  | "promotions"
  | "social"
  | "updates"
  | "subscriptions";

export type ApiGmailCategory = Exclude<GmailCategory, "primary">;

const PAGE_SIZE = 25;

export function useGmailMessagesPagination(folder: GmailFolder, q?: string) {
  const [pageToken, setPageToken] = useState<string | undefined>();
  const [messages, setMessages] = useState<GmailMessageSummaryType[]>([]);

  const input = { maxResults: PAGE_SIZE, pageToken, q };

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

  useEffect(() => {
    setPageToken(undefined);
    setMessages([]);
  }, [folder, q]);

  useEffect(() => {
    if (!data) return;
    setMessages((prev) => (pageToken ? [...prev, ...data.messages] : data.messages));
  }, [data, pageToken]);

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
    hasMore: Boolean(data?.nextPageToken),
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

/** Inbox category tabs: primary → inbox API; others → listByCategory */
export function useGmailCategoryPagination(category: GmailCategory) {
  const [pageToken, setPageToken] = useState<string | undefined>();
  const [messages, setMessages] = useState<GmailMessageSummaryType[]>([]);

  const useInbox = category === "primary";

  const inboxQuery = trpc.gmail.inbox.useQuery(
    { maxResults: PAGE_SIZE, pageToken },
    { enabled: useInbox },
  );

  const categoryQuery = trpc.gmail.listByCategory.useQuery(
    {
      category: category as ApiGmailCategory,
      maxResults: PAGE_SIZE,
      pageToken,
    },
    { enabled: !useInbox },
  );

  const { data, isPending, isFetching, isError, refetch } = useInbox ? inboxQuery : categoryQuery;

  useEffect(() => {
    setPageToken(undefined);
    setMessages([]);
  }, [category]);

  useEffect(() => {
    if (!data) return;
    setMessages((prev) => (pageToken ? [...prev, ...data.messages] : data.messages));
  }, [data, pageToken]);

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
    hasMore: Boolean(data?.nextPageToken),
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

export function useGmailLabelPagination(labelId: string, q?: string) {
  const [pageToken, setPageToken] = useState<string | undefined>();
  const [messages, setMessages] = useState<GmailMessageSummaryType[]>([]);

  const enabled = Boolean(labelId);
  const query = trpc.gmail.listByLabel.useQuery(
    { labelId, maxResults: PAGE_SIZE, pageToken, q },
    { enabled },
  );

  const { data, isPending, isFetching, isError, refetch } = query;

  useEffect(() => {
    setPageToken(undefined);
    setMessages([]);
  }, [labelId, q]);

  useEffect(() => {
    if (!data) return;
    setMessages((prev) => (pageToken ? [...prev, ...data.messages] : data.messages));
  }, [data, pageToken]);

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
    hasMore: Boolean(data?.nextPageToken),
    loadMore,
    refetch,
    markMessageReadLocally,
    setMessageUnread,
    removeMessageLocally,
    restoreMessageLocally,
    isPending: enabled && isPending && messages.length === 0,
    isLoadingMore: isFetching && messages.length > 0,
    isError,
  };
}

export function useGmailInboxPagination(q?: string) {
  return useGmailMessagesPagination("inbox", q);
}
