"use client";

import { deleteGmailMessage } from "~/hooks/gmail";
import { useGmailMessagesPagination } from "~/hooks/gmail/pagination";
import { toast } from "sonner";
import { MailFolderView } from "./MailFolderView";

export function Sent() {
  const {
    messages,
    hasMore,
    loadMore,
    removeMessageLocally,
    restoreMessageLocally,
    isPending,
    isLoadingMore,
    isError,
  } = useGmailMessagesPagination("sent");

  const { mutateAsync: deleteMessage, status: deleteStatus } = deleteGmailMessage();

  async function handleDeleteMessage(id: string) {
    const removed = messages.find((m) => m.id === id);
    if (!removed) return;

    removeMessageLocally(id);
    try {
      await deleteMessage({ id, permanent: false, isDraft: false });
      toast.success("Message moved to trash");
    } catch {
      restoreMessageLocally(removed);
      toast.error("Couldn't move message to trash");
      throw new Error("delete failed");
    }
  }

  return (
    <MailFolderView
      title="Sent"
      messages={messages}
      isPending={isPending}
      isError={isError}
      errorLabel="Couldn’t load sent messages."
      emptyLabel="No sent messages."
      peerField="to"
      showUnreadStyles={false}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      onLoadMore={loadMore}
      onDelete={handleDeleteMessage}
      isDeleting={deleteStatus === "pending"}
    />
  );
}
