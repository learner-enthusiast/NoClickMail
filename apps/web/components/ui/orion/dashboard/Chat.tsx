"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  FileText,
  PenLine,
  Repeat,
  Send,
  Paperclip,
  Image as ImageIcon,
  CalendarPlus,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { runAgent, agentThreadMessages, agentThreads } from "~/hooks/agent.ts";
import { trpc } from "~/trpc/client";
import { cn } from "~/lib/utils";

import { gmailSentContacts } from "~/hooks/gmail";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../tooltip";
import { createCalendarEvent } from "~/hooks/calendar";
import { toast } from "sonner";
import CalendarInviteDialog from "../../calendarinvite";
const QUICK_ACTIONS = [
  { label: "Summarize", icon: FileText, prompt: "Summarize the key risks in the selected report." },
  { label: "Draft", icon: PenLine, prompt: "Draft a concise response to the selected email." },
  {
    label: "Rewrite",
    icon: Repeat,
    prompt: "Rewrite the selected text to be clearer and more professional.",
  },
] as const;

function Bubble({ role, content }: { role: "user" | "assistant" | "system"; content: string }) {
  if (role === "system") return null;
  return (
    <div
      className={cn(
        "max-w-[85%] px-4 py-3 text-sm",
        role === "user"
          ? "ml-auto rounded-2xl rounded-tr-sm bg-primary text-primary-foreground"
          : "mr-auto rounded-2xl rounded-tl-sm bg-secondary text-foreground",
      )}
    >
      <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
    </div>
  );
}

/** Persisted transcript — only mounted when a thread exists, so the query always has a valid id. */
function Transcript({
  threadId,
  pendingUser,
  isRunning,
  scrollRef,
}: {
  threadId: string;
  pendingUser: string | null;
  isRunning: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { data: messages, isPending } = agentThreadMessages({ threadId });

  useEffect(() => {
    requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }),
    );
  }, [messages, pendingUser, isRunning, scrollRef]);

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading conversation…</p>;
  }

  return (
    <>
      {(messages ?? []).map((m) => (
        <Bubble key={m.id} role={m.role} content={m.content} />
      ))}
      {/* Optimistic: show the in-flight user turn before the server round-trip persists it */}
      {pendingUser && <Bubble role="user" content={pendingUser} />}
      {isRunning && (
        <div className="mr-auto max-w-[85%] rounded-2xl rounded-tl-sm bg-secondary px-4 py-3 text-sm text-muted-foreground">
          Thinking…
        </div>
      )}
    </>
  );
}

export function Chat() {
  const utils = trpc.useUtils();
  const { mutateAsync, status } = runAgent();
  const { data: threads } = agentThreads();

  const [threadId, setThreadId] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [input, setInput] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);

  const isRunning = status === "pending";
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<{ query: string; start: number; caret: number } | null>(
    null,
  );
  const [activeIndex, setActiveIndex] = useState(0);
  // Lazy: fetches once an @-mention begins, then cached (staleTime: Infinity in your QueryClient).
  const { data: contactsData } = gmailSentContacts(
    { maxMessages: 200, limit: 50 },
    mention !== null,
  );
  const [inviteOpen, setInviteOpen] = useState(false);
  const { mutateAsync: createEvent, status: createStatus } = createCalendarEvent();
  const isCreating = createStatus === "pending";
  const suggestions = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return (contactsData?.contacts ?? [])
      .filter(
        (c) => c.email.toLowerCase().includes(q) || (c.name?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, 6);
  }, [contactsData, mention]);
  // Restore the most recent thread on first load (optional).
  useEffect(() => {
    if (!threadId && threads && threads.length > 0) {
      setThreadId(threads[0]!.id);
    }
  }, [threads, threadId]);

  async function send(prompt: string) {
    const text = prompt.trim();
    if (!text || isRunning) return;

    setInput("");
    setPendingUser(text);

    try {
      const res = await mutateAsync({ prompt: text, threadId: threadId ?? undefined });
      setThreadId(res.threadId);
      // Persisted messages are the source of truth → refetch this thread.
      await utils.agent.threadMessages.invalidate({ threadId: res.threadId });
      await utils.agent.listThreads.invalidate();
    } catch (e) {
      console.error(e);
    } finally {
      setPendingUser(null);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }
  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setInput(value);

    const caret = e.target.selectionStart ?? value.length;
    // Match "@query" at the caret, where @ is at start or preceded by whitespace.
    const match = /(?:^|\s)@([^\s@]*)$/.exec(value.slice(0, caret));
    if (match) {
      setMention({ query: match[1] ?? "", start: caret - (match[1]?.length ?? 0) - 1, caret });
      setActiveIndex(0);
    } else {
      setMention(null);
    }
  }

  function selectContact(email: string) {
    if (!mention) return;
    const before = input.slice(0, mention.start); // text before the "@"
    const after = input.slice(mention.caret); // text after what was typed
    const next = `${before}@${email} ${after}`;
    setInput(next);
    setMention(null);

    // restore focus + caret after the inserted email
    const pos = before.length + email.length + 2; // "@" + email + space
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  }
  return (
    <aside className="flex h-full w-full flex-col border-l border-border bg-sidebar">
      <CalendarInviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        isSubmitting={isCreating}
        onSubmit={async (values) => {
          try {
            const result = await createEvent(values);
            await utils.calendar.events.invalidate();
            toast.success("Calendar invite created");
            if (result.htmlLink) window.open(result.htmlLink, "_blank");
          } catch (err) {
            console.error(err);
            toast.error("Failed to create calendar invite");
            throw err;
          }
        }}
      />
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-4">
        <div className="flex size-9 items-center justify-center rounded-full bg-accent">
          <Sparkles className="size-5 text-accent-foreground" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold text-foreground">Orion Intelligence</p>
          <p className="text-[10px] tracking-[0.15em] text-muted-foreground">ACTIVE ASSISTANT</p>
        </div>
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {threadId ? (
          <Transcript
            threadId={threadId}
            pendingUser={pendingUser}
            isRunning={isRunning}
            scrollRef={scrollRef}
          />
        ) : (
          <>
            {!pendingUser && (
              <div className="rounded-2xl rounded-tl-sm bg-secondary px-4 py-3 text-sm text-foreground">
                Hello. Ask me to summarize, draft, or rewrite — or anything about your inbox.
              </div>
            )}
            {pendingUser && <Bubble role="user" content={pendingUser} />}
            {isRunning && (
              <div className="mr-auto max-w-[85%] rounded-2xl rounded-tl-sm bg-secondary px-4 py-3 text-sm text-muted-foreground">
                Thinking…
              </div>
            )}
          </>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-2 px-4 pb-2">
        {QUICK_ACTIONS.map(({ label, icon: Icon, prompt }) => (
          <button
            key={label}
            type="button"
            disabled={isRunning}
            onClick={() => send(prompt)}
            className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-2 py-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
          >
            <Icon className="size-4 text-primary" />
            {label}
          </button>
        ))}
      </div>

      {/* Composer */}
      <form onSubmit={onSubmit} className="border-t border-border p-3">
        <div className="rounded-xl border border-border bg-background p-2">
          <div className="relative rounded-xl border border-border bg-background p-2">
            {/* Mention dropdown */}
            {mention && suggestions.length > 0 && (
              <ul className="absolute bottom-full left-0 right-0 mb-2 max-h-56 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md">
                {suggestions.map((c, i) => (
                  <li key={c.email}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault(); // keep textarea focus
                        selectContact(c.email);
                      }}
                      className={cn(
                        "flex w-full flex-col items-start rounded-md px-3 py-2 text-left text-sm",
                        i === activeIndex
                          ? "bg-secondary text-foreground"
                          : "hover:bg-secondary/60",
                      )}
                    >
                      <span className="font-medium text-foreground">{c.name ?? c.email}</span>
                      {c.name && <span className="text-xs text-muted-foreground">{c.email}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleChange}
              onKeyDown={(e) => {
                // When the mention box is open, hijack nav keys
                if (mention && suggestions.length > 0) {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveIndex((i) => (i + 1) % suggestions.length);
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
                    return;
                  }
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    selectContact(suggestions[activeIndex]!.email);
                    return;
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setMention(null);
                    return;
                  }
                }
                // Normal send behavior
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask Orion anything… (type @ to mention a contact)"
              rows={2}
              disabled={isRunning}
              className="w-full resize-none bg-transparent px-2 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50"
            />
          </div>

          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Insert calendar invite"
                    onClick={() => setInviteOpen(true)}
                  >
                    <CalendarPlus className="size-4 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Create a calendar invite</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">Orion 2.4 Ultra</span>
              <Button
                type="submit"
                size="icon-sm"
                disabled={isRunning || !input.trim()}
                aria-label="Send"
              >
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </form>
    </aside>
  );
}
