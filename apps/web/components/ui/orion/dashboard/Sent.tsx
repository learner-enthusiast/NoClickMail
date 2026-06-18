"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useGmailMessagesPagination } from "~/hooks/gmail/pagination";
import { MailMessageList } from "./MailMessageList";
import { MailReader } from "./Inbox";
// extract when ready

export function Sent() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { messages, hasMore, loadMore, isPending, isLoadingMore, isError } =
    useGmailMessagesPagination("sent");

  if (isPending)
    return (
      <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  if (isError) return <div>Could not load sent messages.</div>;

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full">
      <MailMessageList
        title="Sent"
        messages={messages}
        selectedId={selectedId}
        onSelectMessage={(msg) => setSelectedId(msg.id)}
        peerField="to"
        showUnreadStyles={false}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMore}
      />
      {selectedId && <MailReader id={selectedId} onBack={() => setSelectedId(null)} />}
    </div>
  );
}
