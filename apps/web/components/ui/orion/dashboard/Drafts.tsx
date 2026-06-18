"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useGmailMessagesPagination } from "~/hooks/gmail/pagination";
import { MailMessageList } from "./MailMessageList";
import { MailReader } from "./Inbox";
import { deleteGmailMessage } from "~/hooks/gmail";
import { toast } from "sonner";

export function Drafts() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
    // Optimistic: remove from list + close reader
    removeMessageLocally(id);
    setSelectedId(null);
    try {
      await deleteMessage({
        id,
        permanent: false, // move to trash
        isDraft: true,
      });
      toast.success("Message moved to trash");
    } catch {
      restoreMessageLocally(removed);
      setSelectedId(id);
      toast.error("Couldn't move message to trash");
    }
  }
  if (isPending) {
    return (
      <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center text-sm text-destructive">
        Couldn’t load your drafts.
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full">
      <MailMessageList
        title="Drafts"
        messages={messages}
        selectedId={selectedId}
        onSelectMessage={(msg) => setSelectedId(msg.id)}
        peerField="to"
        showUnreadStyles={false}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMore}
        emptyLabel="No drafts."
      />

      {selectedId && (
        <MailReader
          id={selectedId}
          onBack={() => setSelectedId(null)}
          isDraft={true}
          onDelete={handleDeleteMessage}
          isDeleting={deleteStatus === "pending"}
        />
      )}
    </div>
  );
}
