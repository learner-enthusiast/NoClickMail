"use client";

import { useState } from "react";
import type { GmailMessageSummaryType } from "@repo/services/gmail/model";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "~/components/ui/resizable";
import { PairedRevolution } from "../PairedRevolution";
import { MailMessageList } from "./MailMessageList";
import { gmailDraft, gmailMessage } from "~/hooks/gmail";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Button } from "../../button";
import { ArrowLeft, Trash2 } from "lucide-react";
function parseFrom(from: string | null) {
  if (!from) return { name: "Unknown", email: "" };
  const m = from.match(/^(.*)<([^>]+)>$/);
  if (m) return { name: (m[1]?.trim().replace(/^"|"$/g, "") || m[2]) ?? "", email: m[2] ?? "" };
  return { name: from, email: from };
}

function initials(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}
export type MailFolderViewProps = {
  title: string;
  messages: GmailMessageSummaryType[];
  isPending: boolean;
  isError: boolean;
  errorLabel?: string;
  emptyLabel?: string;
  peerField?: "from" | "to";
  showUnreadStyles?: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  /** Called when a row is selected (e.g. mark-as-read for inbox) */
  onSelectMessage?: (message: GmailMessageSummaryType) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
  isDeleting?: boolean;
  isDraft?: boolean;
};

export function MailFolderView({
  title,
  messages,
  isPending,
  isError,
  errorLabel = "Couldn’t load messages.",
  emptyLabel = "No messages.",
  peerField = "from",
  showUnreadStyles = true,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  onSelectMessage,
  onDelete,
  isDeleting = false,
  isDraft = false,
}: MailFolderViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function handleSelectMessage(msg: GmailMessageSummaryType) {
    setSelectedId(msg.id);
    await onSelectMessage?.(msg);
  }

  function handleBack() {
    setSelectedId(null);
  }

  async function handleDelete(id: string) {
    await onDelete?.(id);
    setSelectedId(null);
  }

  if (isPending) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center p-6 text-sm text-muted-foreground">
        <PairedRevolution />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center p-6 text-sm text-destructive">
        {errorLabel}
      </div>
    );
  }

  const list = (
    <MailMessageList
      title={title}
      messages={messages}
      selectedId={selectedId}
      onSelectMessage={handleSelectMessage}
      peerField={peerField}
      showUnreadStyles={showUnreadStyles}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      onLoadMore={onLoadMore}
      emptyLabel={emptyLabel}
    />
  );

  return (
    <div className="h-full min-h-0 w-full">
      {!selectedId ? (
        list
      ) : (
        <ResizablePanelGroup
          direction="horizontal"
          autoSaveId="mail-layout"
          className="h-full w-full"
        >
          <ResizablePanel defaultSize={35} minSize={20} maxSize={50} className="overflow-hidden">
            {list}
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={65} minSize={40} className="overflow-hidden">
            <MailReader
              id={selectedId}
              onBack={handleBack}
              onDelete={onDelete ? handleDelete : undefined}
              isDeleting={isDeleting}
              isDraft={isDraft}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </div>
  );
}
export function MailReader({
  id,
  onBack,
  onDelete,
  isDeleting = false,
  isDraft = false,
}: {
  id: string;
  onBack: () => void;
  onDelete?: (id: string) => void | Promise<void>;
  isDeleting?: boolean;
  isDraft?: boolean;
}) {
  const { data: msg, isPending, isError } = isDraft ? gmailDraft({ id }) : gmailMessage({ id });

  if (isPending) {
    return <div className="flex-1 p-6 text-sm text-muted-foreground">Loading message…</div>;
  }
  if (isError || !msg) {
    return <div className="flex-1 p-6 text-sm text-destructive">Couldn’t load this message.</div>;
  }

  const { name, email } = parseFrom(msg.from);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Back" onClick={onBack}>
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
              {isDeleting ? <PairedRevolution /> : <Trash2 className="size-5" />}
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
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
