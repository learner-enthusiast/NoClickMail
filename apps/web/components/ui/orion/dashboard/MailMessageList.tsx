"use client";

import { Loader2 } from "lucide-react";
import type { GmailMessageSummaryType } from "@repo/services/gmail/model";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

function parseAddress(value: string | null) {
  if (!value) return { name: "Unknown", email: "" };
  const m = value.match(/^(.*)<([^>]+)>$/);
  if (m) return { name: (m[1]?.trim().replace(/^"|"$/g, "") || m[2]) ?? "", email: m[2] ?? "" };
  return { name: value, email: value };
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

export type MailMessageListProps = {
  title: string;
  messages: GmailMessageSummaryType[];
  selectedId: string | null;
  onSelectMessage: (message: GmailMessageSummaryType) => void | Promise<void>;
  /** Who to show in the row: sender for inbox, recipient for sent/drafts */
  peerField?: "from" | "to";
  /** Inbox: style by unread. Sent/drafts: pass false if you don't want read/unread styling */
  showUnreadStyles?: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  emptyLabel?: string;
};

export function MailMessageList({
  title,
  messages,
  selectedId,
  onSelectMessage,
  peerField = "from",
  showUnreadStyles = true,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  emptyLabel = "No messages.",
}: MailMessageListProps) {
  return (
    <div className={cn("flex flex-col border-r border-border")}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-headline-sm font-bold text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground">{messages.length} messages</span>
      </div>

      <ul className="flex-1 divide-y divide-border overflow-y-auto">
        {messages.map((msg) => {
          const { name } = parseAddress(msg[peerField]);
          const isSelected = msg.id === selectedId;
          const isUnread = showUnreadStyles && msg.unread;

          return (
            <li key={msg.id}>
              <button
                type="button"
                onClick={() => void onSelectMessage(msg)}
                className={cn(
                  "flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors cursor-pointer",
                  isSelected ? "bg-secondary" : "hover:bg-secondary/50",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "truncate text-sm",
                      isUnread ? "font-bold text-foreground" : "font-normal text-muted-foreground",
                    )}
                  >
                    {name}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-xs",
                      isUnread ? "text-foreground/80" : "text-muted-foreground/70",
                    )}
                  >
                    {formatDate(msg.date)}
                  </span>
                </div>

                <span
                  className={cn(
                    "truncate text-sm",
                    isUnread
                      ? "font-semibold text-foreground"
                      : "font-normal text-muted-foreground",
                  )}
                >
                  {msg.subject ?? "(no subject)"}
                </span>

                <span
                  className={cn(
                    "line-clamp-1 text-xs",
                    isUnread ? "text-foreground/70" : "text-muted-foreground/60",
                  )}
                >
                  {msg.snippet}
                </span>
              </button>
            </li>
          );
        })}

        {messages.length === 0 && (
          <li className="p-6 text-center text-sm text-muted-foreground">{emptyLabel}</li>
        )}

        {hasMore && onLoadMore && (
          <li className="border-t border-border px-4 py-3">
            <Button
              variant="outline"
              className="w-full"
              disabled={isLoadingMore}
              onClick={onLoadMore}
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Loading…
                </>
              ) : (
                "Show more"
              )}
            </Button>
          </li>
        )}
      </ul>
    </div>
  );
}
