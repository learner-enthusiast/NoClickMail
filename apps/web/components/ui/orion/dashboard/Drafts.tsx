"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useGmailMessagesPagination } from "~/hooks/gmail/pagination";
import { MailMessageList } from "./MailMessageList";
import { MailReader } from "./Inbox";

export function Drafts() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { messages, hasMore, loadMore, isPending, isLoadingMore, isError } =
    useGmailMessagesPagination("draft");

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

      {selectedId && <MailReader id={selectedId} onBack={() => setSelectedId(null)} />}
    </div>
  );
}
