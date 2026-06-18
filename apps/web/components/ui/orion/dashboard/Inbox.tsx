"use client";

import { useState } from "react";
import { ArrowLeft, Reply, MoreVertical, Loader2, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { deleteGmailMessage, gmailInbox, gmailMessage, markGmailMessageRead } from "~/hooks/gmail";
import { cn } from "~/lib/utils";
import { useGmailInboxPagination, useGmailMessagesPagination } from "~/hooks/gmail/pagination";
import { MailMessageList } from "./MailMessageList";
import { toast } from "sonner";

function parseFrom(from: string | null) {
  if (!from) return { name: "Unknown", email: "" };
  const m = from.match(/^(.*)<([^>]+)>$/);
  if (m) return { name: (m[1]?.trim().replace(/^"|"$/g, "") || m[2]) ?? "", email: m[2] ?? "" };
  return { name: from, email: from };
}

function initials(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function formatDate(date: string | null) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function Inbox() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
  } = useGmailMessagesPagination("inbox");
  const { mutateAsync: markRead } = markGmailMessageRead();
  const { mutateAsync: deleteMessage, status: deleteStatus } = deleteGmailMessage();

  async function handleSelectMessage(msg: (typeof messages)[number]) {
    setSelectedId(msg.id);
    if (!msg.unread) return;
    // Optimistic: dull styling right away
    markMessageReadLocally(msg.id);
    try {
      await markRead({ id: msg.id, read: true });
    } catch {
      // Revert on failure — simplest: refetch first page state
      // or flip unread back for this id only
      markMessageReadLocally(msg.id); // won't work for revert — see note below
    }
  }
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
        isDraft: false,
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
      <div className="p-6 text-sm text-muted-foreground h-full flex justify-center items-center w-full">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="p-6 text-sm text-destructive h-full flex justify-center items-center w-full">
        Couldn’t load your inbox.
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full">
      {/* List — full width when nothing selected, narrow when reading */}
      <MailMessageList
        title="Inbox"
        messages={messages}
        selectedId={selectedId}
        onSelectMessage={handleSelectMessage}
        peerField="from"
        showUnreadStyles
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMore}
      />

      {/* Reader — only when an email is opened */}
      {selectedId && (
        <MailReader
          id={selectedId}
          onBack={() => {
            setSelectedId(null);
          }}
          onDelete={handleDeleteMessage}
          isDeleting={deleteStatus === "pending"}
        />
      )}
    </div>
  );
}

export function MailReader({
  id,
  onBack,
  onDelete,
  isDeleting = false,
}: {
  id: string;
  onBack: () => void;
  onDelete?: (id: string) => void | Promise<void>;
  isDeleting?: boolean;
}) {
  const { data: msg, isPending, isError } = gmailMessage({ id });

  if (isPending) {
    return <div className="flex-1 p-6 text-sm text-muted-foreground">Loading message…</div>;
  }
  if (isError || !msg) {
    return <div className="flex-1 p-6 text-sm text-destructive">Couldn’t load this message.</div>;
  }

  const { name, email } = parseFrom(msg.from);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Reply" onClick={onBack}>
            <ArrowLeft className="size-5" />
          </Button>
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Move to trash"
              disabled={isDeleting}
              onClick={() => void onDelete(id)}
            >
              {isDeleting ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Trash2 className="size-5" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <h1 className="mb-4 text-headline-sm font-bold text-foreground">
          {msg.subject ?? "(no subject)"}
        </h1>

        <div className="mb-6 flex items-center gap-3">
          <Avatar className="size-10">
            <AvatarFallback className="bg-surface-bright text-sm text-foreground">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
        </div>

        <MailBody bodyHtml={msg.bodyHtml} bodyText={msg.bodyText} snippet={msg.snippet} />
      </div>
    </div>
  );
}

export function MailBody({
  bodyHtml,
  bodyText,
  snippet,
}: {
  bodyHtml: string | null;
  bodyText: string | null;
  snippet: string;
}) {
  if (bodyHtml) {
    // Sandboxed iframe isolates email HTML/CSS and blocks scripts (XSS-safe).
    return (
      <iframe
        title="Email content"
        sandbox=""
        srcDoc={bodyHtml}
        className="h-[60vh] w-full rounded-md border border-border bg-white"
      />
    );
  }
  if (bodyText) {
    return (
      <p className="whitespace-pre-wrap text-body-md leading-relaxed text-foreground">{bodyText}</p>
    );
  }
  return <p className="text-body-md text-muted-foreground">{snippet}</p>;
}
