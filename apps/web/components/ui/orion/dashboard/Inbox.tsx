"use client";

import { useState } from "react";
import { deleteGmailMessage, markGmailMessageRead } from "~/hooks/gmail";
import { type GmailCategory, useGmailCategoryPagination } from "~/hooks/gmail/pagination";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { MailFolderView } from "./MailFolderView";

const TABS: { value: GmailCategory; label: string }[] = [
  { value: "primary", label: "Primary" },
  { value: "primary_unread", label: "Unread" },
  { value: "promotions", label: "Promotions" },
  { value: "social", label: "Social" },
  { value: "updates", label: "Updates" },
  { value: "subscriptions", label: "Subscriptions" },
];

export function Inbox() {
  const [category, setCategory] = useState<GmailCategory>("primary");
  const title = TABS.find((t) => t.value === category)?.label ?? "Inbox";

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
  } = useGmailCategoryPagination(category);

  const { mutateAsync: markRead } = markGmailMessageRead();
  const { mutateAsync: deleteMessage, status: deleteStatus } = deleteGmailMessage();

  async function handleSelectMessage(msg: (typeof messages)[number]) {
    if (!msg.unread) return;
    markMessageReadLocally(msg.id);
    try {
      await markRead({ id: msg.id, read: true });
    } catch {
      // next refetch corrects
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
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="shrink-0 border-b border-border px-3 py-2">
        <Tabs value={category} onValueChange={(v) => setCategory(v as GmailCategory)}>
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-md px-3 data-[state=active]:bg-secondary data-[state=active]:shadow-none cursor-pointer"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="min-h-0 flex-1">
        <MailFolderView
          title={title}
          messages={messages}
          isPending={isPending}
          isError={isError}
          errorLabel={`Couldn’t load ${title.toLowerCase()}.`}
          emptyLabel={`No messages in ${title}.`}
          peerField="from"
          showUnreadStyles
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={loadMore}
          onSelectMessage={handleSelectMessage}
          onDelete={handleDeleteMessage}
          isDeleting={deleteStatus === "pending"}
        />
      </div>
    </div>
  );
}
