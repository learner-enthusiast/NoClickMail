"use client";

import { useMemo } from "react";
import { deleteGmailMessage, gmailListLabels, markGmailMessageRead } from "~/hooks/gmail";
import { useGmailLabelPagination } from "~/hooks/gmail/pagination";
import { toast } from "sonner";
import { MailFolderView } from "./MailFolderView";

type LabelMailProps = {
  labelId: string;
};

export function LabelMail({ labelId }: LabelMailProps) {
  const { data: labelsData } = gmailListLabels();
  const title = useMemo(() => {
    const match = labelsData?.labels?.find((l) => l.id === labelId);
    return match?.name ?? labelId;
  }, [labelsData?.labels, labelId]);

  const {
    messages,
    hasMore,
    loadMore,
    markMessageReadLocally,
    removeMessageLocally,
    restoreMessageLocally,
    isPending,
    isLoadingMore,
    isError,
  } = useGmailLabelPagination(labelId);

  const { mutateAsync: markRead } = markGmailMessageRead();
  const { mutateAsync: deleteMessage, status: deleteStatus } = deleteGmailMessage();

  async function handleSelectMessage(msg: (typeof messages)[number]) {
    if (!msg.unread) return;
    markMessageReadLocally(msg.id);
    try {
      await markRead({ id: msg.id, read: true });
    } catch {
      // leave local state; next refetch corrects
    }
  }

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
      title={title}
      messages={messages}
      isPending={isPending}
      isError={isError}
      errorLabel="Couldn’t load this label."
      emptyLabel="No messages with this label."
      peerField="from"
      showUnreadStyles
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      onLoadMore={loadMore}
      onSelectMessage={handleSelectMessage}
      onDelete={handleDeleteMessage}
      isDeleting={deleteStatus === "pending"}
    />
  );
}
