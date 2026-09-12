"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  FileText,
  PenLine,
  Repeat,
  Send,
  CalendarPlus,
  Square,
  Paperclip,
  X,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { runAgent, agentThreadMessages, agentThreads } from "~/hooks/agent.ts";
import { trpc } from "~/trpc/client";
import { cn } from "~/lib/utils";

import { gmailSentContacts } from "~/hooks/gmail";
import { agentAbort, isAbortError } from "~/lib/agent-abort";
import { AGENT_FILE_ACCEPT, readFileAsBase64, type AttachedAgentFile } from "~/lib/agent-file";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../tooltip";
import { createCalendarEvent } from "~/hooks/calendar";
import { toast } from "sonner";
import CalendarInviteDialog from "../../calendarinvite";
import { ThinkingBubble } from "./ThinkingBubble";
import { ChatErrorBubble, ChatMessageBubble } from "./ChatMessageBubble";
import type { AgentStreamEventModelType } from "@repo/trpc/client";

const QUICK_ACTIONS = [
  { label: "Summarize", icon: FileText, prompt: "Summarize the key risks in the selected report." },
  { label: "Draft", icon: PenLine, prompt: "Draft a concise response to the selected email." },
  {
    label: "Rewrite",
    icon: Repeat,
    prompt: "Rewrite the selected text to be clearer and more professional.",
  },
] as const;

function pendingUserVisible(
  pendingUser: string | null,
  messages: { role: string; content: string }[] | undefined,
) {
  if (!pendingUser) return false;
  return !messages?.some((m) => m.role === "user" && m.content === pendingUser);
}

/** Transcript — server messages plus optimistic in-flight user turn. */
function Transcript({
  threadId,
  pendingUser,
  isBusy,
  streamingAssistant,
  streamingApprovalIds,
  errorMessage,
  scrollRef,
}: {
  threadId: string | null;
  pendingUser: string | null;
  isBusy: boolean;
  streamingAssistant: string | null;
  streamingApprovalIds: string[];
  errorMessage: string | null;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { data: messages, isPending } = agentThreadMessages(
    { threadId: threadId! },
    threadId !== null,
  );
  const showPendingUser = pendingUserVisible(pendingUser, messages);

  useEffect(() => {
    requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }),
    );
  }, [messages, pendingUser, isBusy, streamingAssistant, streamingApprovalIds, errorMessage, scrollRef]);

  const showInitialLoading =
    threadId !== null && isPending && !messages?.length && !showPendingUser && !isBusy;

  return (
    <>
      {!threadId && !pendingUser && !errorMessage && (
        <div className="rounded-2xl rounded-tl-sm bg-secondary px-4 py-3 text-sm text-foreground">
          Hello. Ask me to summarize, draft, or rewrite — or anything about your inbox.
        </div>
      )}
      {showInitialLoading && <p className="text-sm text-muted-foreground">Loading conversation…</p>}
      {(messages ?? [])
        .filter((m): m is typeof m & { role: "user" | "assistant" } =>
          m.role === "user" || m.role === "assistant",
        )
        .map((m) => (
          <ChatMessageBubble
            key={m.id}
            role={m.role}
            content={m.content}
            approvalId={m.approvalId}
          />
        ))}
      {showPendingUser && pendingUser && (
        <ChatMessageBubble role="user" content={pendingUser} />
      )}
      {isBusy && !streamingAssistant && <ThinkingBubble />}
      {streamingAssistant && (
        <ChatMessageBubble
          role="assistant"
          content={streamingAssistant}
          approvalIds={streamingApprovalIds}
        />
      )}
      {errorMessage && !isBusy && <ChatErrorBubble message={errorMessage} />}
    </>
  );
}

function getErrorMessage(e: unknown): string {
  if (e && typeof e === "object" && "message" in e && typeof e.message === "string") {
    return e.message;
  }
  return "Something went wrong. Please try again.";
}

export function Chat() {
  const utils = trpc.useUtils();
  const { mutateAsync, reset, status } = runAgent();
  const { data: threads } = agentThreads();

  const [threadId, setThreadId] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [streamingAssistant, setStreamingAssistant] = useState<string | null>(null);
  const [streamingApprovalIds, setStreamingApprovalIds] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [attachedFile, setAttachedFile] = useState<AttachedAgentFile | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isRunning = status === "pending";
  const isBusy = pendingUser !== null || isRunning;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<{ query: string; start: number; caret: number } | null>(
    null,
  );
  const [activeIndex, setActiveIndex] = useState(0);
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

  useEffect(() => {
    if (!threadId && threads && threads.length > 0) {
      setThreadId(threads[0]!.id);
    }
  }, [threads, threadId]);

  async function syncThreadMessages(preferredThreadId?: string | null) {
    await utils.agent.listThreads.invalidate();
    const latest = await utils.agent.listThreads.fetch();
    const id = preferredThreadId ?? latest[0]?.id;
    if (id) {
      setThreadId(id);
      await utils.agent.threadMessages.invalidate({ threadId: id });
      await utils.agent.threadMessages.refetch({ threadId: id });
    }
    return id;
  }

  async function consumeAgentStream(
    stream: AsyncIterable<AgentStreamEventModelType>,
    activeThreadId: string | null,
    optimisticId: string,
  ) {
    let resolvedThreadId = activeThreadId;

    for await (const event of stream) {
      if (event.type === "meta") {
        resolvedThreadId = event.threadId;
        if (!activeThreadId) {
          setThreadId(event.threadId);
        }
      } else if (event.type === "approval_created") {
        setStreamingApprovalIds((prev) =>
          prev.includes(event.approvalId) ? prev : [...prev, event.approvalId],
        );
        void utils.corsairApprovals.listPending.invalidate();
      } else if (event.type === "delta") {
        setStreamingAssistant((prev) => (prev ?? "") + event.text);
      } else if (event.type === "done") {
        resolvedThreadId = event.threadId;
        if (!activeThreadId || activeThreadId !== event.threadId) {
          setThreadId(event.threadId);
        }
        if (event.approvalId) {
          setStreamingApprovalIds((prev) =>
            prev.includes(event.approvalId!) ? prev : [...prev, event.approvalId!],
          );
        }
      }
    }

    if (activeThreadId && resolvedThreadId && activeThreadId !== resolvedThreadId) {
      utils.agent.threadMessages.setData({ threadId: activeThreadId }, (prev) =>
        (prev ?? []).filter((m) => m.id !== optimisticId),
      );
    }

    if (resolvedThreadId) {
      await utils.agent.threadMessages.invalidate({ threadId: resolvedThreadId });
      await utils.agent.threadMessages.refetch({ threadId: resolvedThreadId });
      await utils.agent.listThreads.invalidate();
      setPendingUser(null);
      setStreamingAssistant(null);
      setStreamingApprovalIds([]);
    }
  }

  async function send(prompt: string, file: AttachedAgentFile | null = attachedFile) {
    const text = prompt.trim();
    if ((!text && !file) || isBusy) return;

    agentAbort.abort();
    agentAbort.set(new AbortController());

    setInput("");
    setAttachedFile(null);
    const displayUser = file && !text ? `📎 ${file.filename}` : text;
    setPendingUser(displayUser);
    setStreamingAssistant(null);
    setStreamingApprovalIds([]);
    setErrorMessage(null);

    const activeThreadId = threadId;
    const optimisticId = `optimistic-${Date.now()}`;

    if (activeThreadId) {
      utils.agent.threadMessages.setData({ threadId: activeThreadId }, (prev) => [
        ...(prev ?? []),
        {
          id: optimisticId,
          threadId: activeThreadId,
          role: "user" as const,
          content: displayUser,
          approvalId: null,
          createdAt: new Date().toISOString(),
        },
      ]);
    }

    try {
      const stream = await mutateAsync({
        prompt: text,
        threadId: activeThreadId ?? undefined,
        file: file ?? undefined,
      });
      await consumeAgentStream(stream, activeThreadId, optimisticId);
    } catch (e) {
      if (isAbortError(e)) {
        if (activeThreadId) {
          utils.agent.threadMessages.setData({ threadId: activeThreadId }, (prev) =>
            (prev ?? []).filter((m) => m.id !== optimisticId),
          );
        }
        toast.message("Stopped");
        setStreamingAssistant(null);
        setStreamingApprovalIds([]);
        await syncThreadMessages(activeThreadId);
        setPendingUser(null);
        return;
      }

      console.error(e);
      const message = getErrorMessage(e);
      setErrorMessage(message);
      setStreamingAssistant(null);
      setStreamingApprovalIds([]);
      toast.error(message);

      const syncedId = await syncThreadMessages(activeThreadId);
      if (activeThreadId) {
        utils.agent.threadMessages.setData({ threadId: activeThreadId }, (prev) =>
          (prev ?? []).filter((m) => m.id !== optimisticId),
        );
      }
      if (syncedId) {
        setPendingUser(null);
      } else {
        setInput(text);
        setPendingUser(null);
      }
    } finally {
      agentAbort.set(null);
    }
  }

  function stopGeneration() {
    agentAbort.abort();
    setStreamingAssistant(null);
    setStreamingApprovalIds([]);
    reset();
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const encoded = await readFileAsBase64(file);
      setAttachedFile(encoded);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to attach file.");
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
    const before = input.slice(0, mention.start);
    const after = input.slice(mention.caret);
    const next = `${before}@${email} ${after}`;
    setInput(next);
    setMention(null);

    const pos = before.length + email.length + 2;
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  }

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l border-border bg-sidebar">
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
      <div className="flex items-center gap-3 border-b border-border px-4 py-4">
        <div className="flex size-9 items-center justify-center rounded-full bg-accent">
          <Sparkles className="size-5 text-accent-foreground" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold text-foreground">Orion Intelligence</p>
          <p className="text-[10px] tracking-[0.15em] text-muted-foreground">ACTIVE ASSISTANT</p>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <Transcript
          threadId={threadId}
          pendingUser={pendingUser}
          isBusy={isBusy}
          streamingAssistant={streamingAssistant}
          streamingApprovalIds={streamingApprovalIds}
          errorMessage={errorMessage}
          scrollRef={scrollRef}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 px-4 pb-2">
        {QUICK_ACTIONS.map(({ label, icon: Icon, prompt }) => (
          <button
            key={label}
            type="button"
            disabled={isBusy}
            onClick={() => send(prompt)}
            className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-2 py-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
          >
            <Icon className="size-4 text-primary" />
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="border-t border-border p-3">
        <div className="rounded-xl border border-border bg-background p-2">
          <div className="relative rounded-xl border border-border bg-background p-2">
            {attachedFile && (
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-2 py-1.5 text-xs">
                <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-foreground">{attachedFile.filename}</span>
                <button
                  type="button"
                  aria-label="Remove attachment"
                  onClick={() => setAttachedFile(null)}
                  className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}
            {mention && suggestions.length > 0 && (
              <ul className="absolute bottom-full left-0 right-0 mb-2 max-h-56 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md">
                {suggestions.map((c, i) => (
                  <li key={c.email}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
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
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask Orion anything… (type @ to mention a contact)"
              rows={2}
              disabled={isBusy}
              className="w-full resize-none bg-transparent px-2 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50"
            />
          </div>

          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept={AGENT_FILE_ACCEPT}
                className="hidden"
                onChange={onFileSelected}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Attach file"
                    disabled={isBusy}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="size-4 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Attach pdf, image, Word, or spreadsheet</p>
                </TooltipContent>
              </Tooltip>
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
              {isBusy ? (
                <Button
                  type="button"
                  size="icon-sm"
                  onClick={stopGeneration}
                  aria-label="Stop generating"
                >
                  <Square className="size-4 fill-current" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon-sm"
                  disabled={!input.trim() && !attachedFile}
                  aria-label="Send"
                >
                  <Send className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </form>
    </aside>
  );
}
