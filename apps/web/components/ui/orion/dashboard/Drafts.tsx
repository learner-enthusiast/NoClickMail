"use client";

import { deleteGmailMessage } from "~/hooks/gmail";
import { useGmailMessagesPagination } from "~/hooks/gmail/pagination";
import { toast } from "sonner";
import { MailFolderView } from "./MailFolderView";

export function Drafts() {
  const {
    messages,
    hasMore,
    loadMore,
    isPending,
    removeMessageLocally,
    restoreMessageLocally,
    isLoadingMore,
    isError,
  } = useGmailMessagesPagination("draft");

  const { mutateAsync: deleteMessage, status: deleteStatus } = deleteGmailMessage();

  async function handleDeleteMessage(id: string) {
    const removed = messages.find((m) => m.id === id);
    if (!removed) return;

    removeMessageLocally(id);
    try {
      await deleteMessage({ id, permanent: false, isDraft: true });
      toast.success("Draft deleted");
    } catch {
      restoreMessageLocally(removed);
      toast.error("Couldn't delete draft");
      throw new Error("delete failed");
    }
  }

  return (
    <MailFolderView
      title="Drafts"
      messages={messages}
      isPending={isPending}
      isError={isError}
      errorLabel="Couldn’t load your drafts."
      emptyLabel="No drafts."
      peerField="to"
      showUnreadStyles={false}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      onLoadMore={loadMore}
      isDraft
      onDelete={handleDeleteMessage}
      isDeleting={deleteStatus === "pending"}
    />
  );
}
