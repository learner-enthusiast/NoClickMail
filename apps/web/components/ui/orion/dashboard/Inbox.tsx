"use client";

import { useState } from "react";
import { ArrowLeft, Reply, MoreVertical } from "lucide-react";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { gmailInbox, gmailMessage } from "~/hooks/gmail";
import { cn } from "~/lib/utils";

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
  const { data, isPending, isError } = gmailInbox({ maxResults: 25 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  console.log(data);
  const messages = data?.messages ?? [];

  if (isPending) {
    return <div className="p-6 text-sm text-muted-foreground">Loading inbox…</div>;
  }
  if (isError) {
    return <div className="p-6 text-sm text-destructive">Couldn’t load your inbox.</div>;
  }
  console.log(messages);

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full">
      {/* List — full width when nothing selected, narrow when reading */}
      <div
        className={cn(
          "flex flex-col border-r border-border",
          selectedId ? "hidden w-full md:flex md:w-[360px]" : "w-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-headline-sm font-bold text-foreground">Inbox</h2>
          <span className="text-xs text-muted-foreground">{messages.length} messages</span>
        </div>

        <ul className="flex-1 divide-y divide-border overflow-y-auto">
          {messages.map((msg) => {
            const { name } = parseFrom(msg.from);
            const isSelected = msg.id === selectedId;

            return (
              <li key={msg.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(msg.id)}
                  className={cn(
                    "flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors",
                    isSelected ? "bg-secondary" : "hover:bg-secondary/50",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "truncate text-sm",
                        msg.unread ? "font-bold text-foreground" : "font-medium text-foreground/90",
                      )}
                    >
                      {name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(msg.date)}
                    </span>
                  </div>

                  <span
                    className={cn(
                      "truncate text-sm",
                      msg.unread ? "font-semibold text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {msg.subject ?? "(no subject)"}
                  </span>

                  <span className="line-clamp-1 text-xs text-muted-foreground">{msg.snippet}</span>
                </button>
              </li>
            );
          })}

          {messages.length === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground">No messages.</li>
          )}
        </ul>
      </div>

      {/* Reader — only when an email is opened */}
      {selectedId && <MailReader id={selectedId} onBack={() => setSelectedId(null)} />}
    </div>
  );
}

function MailReader({ id, onBack }: { id: string; onBack: () => void }) {
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
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onBack}
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Reply">
            <Reply className="size-5" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="More">
            <MoreVertical className="size-5" />
          </Button>
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

function MailBody({
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
