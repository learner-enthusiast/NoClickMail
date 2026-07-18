"use client";

import { deleteGmailMessage } from "~/hooks/gmail";
import { useGmailMessagesPagination } from "~/hooks/gmail/pagination";
import { toast } from "sonner";
import { MailFolderView } from "./MailFolderView";

export function Trash() {
  const {
    messages,
    hasMore,
    loadMore,
    removeMessageLocally,
    restoreMessageLocally,
    isPending,
    isLoadingMore,
    isError,
  } = useGmailMessagesPagination("trash");

  const { mutateAsync: deleteMessage, status: deleteStatus } = deleteGmailMessage();

  async function handleDeleteMessage(id: string) {
    const removed = messages.find((m) => m.id === id);
    if (!removed) return;

    removeMessageLocally(id);
    try {
      await deleteMessage({ id, permanent: true, isDraft: false });
      toast.success("Message permanently deleted");
    } catch {
      restoreMessageLocally(removed);
      toast.error("Couldn't delete message");
      throw new Error("delete failed");
    }
  }

  return (
    <MailFolderView
      title="Trash"
      messages={messages}
      isPending={isPending}
      isError={isError}
      errorLabel="Couldn’t load trash."
      emptyLabel="Trash is empty."
      peerField="from"
      showUnreadStyles={false}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      onLoadMore={loadMore}
      onDelete={handleDeleteMessage}
      isDeleting={deleteStatus === "pending"}
    />
  );
}
