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
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  CHAT_MESSAGES_PAGE_SIZE,
  runAgent,
  agentThreadMessages,
  agentThreads,
} from "~/hooks/agent.ts";
import { trpc } from "~/trpc/client";
import type { RouterOutputs } from "@repo/trpc/client";
import { cn } from "~/lib/utils";

import { gmailSentContacts } from "~/hooks/gmail";
import { agentAbort, isAbortError } from "~/lib/agent-abort";
import {
  AGENT_FILE_ACCEPT,
  MAX_FILES_PER_MESSAGE,
  formatAttachedFilenames,
  readFilesAsBase64,
  resolveMessageAttachmentPreviews,
  toChatAttachmentPreviews,
  type AttachedAgentFile,
  type ChatAttachmentPreview,
} from "~/lib/agent-file";
import { ChatAttachmentPreviews } from "./ChatAttachmentPreviews";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../tooltip";
import { createCalendarEvent } from "~/hooks/calendar";
import { toast } from "sonner";
import CalendarInviteDialog from "../../calendarinvite";
import { ThinkingBubble } from "./ThinkingBubble";
import { ChatErrorBubble, ChatMessageBubble } from "./ChatMessageBubble";
import type { AgentStreamEventModelType } from "@repo/trpc/client";

type ThreadMessage = RouterOutputs["agent"]["threadMessages"]["messages"][number];

function threadMessagesQueryInput(threadId: string) {
  return { threadId, limit: CHAT_MESSAGES_PAGE_SIZE };
}

function appendToLatestThreadPage(
  utils: ReturnType<typeof trpc.useUtils>,
  threadId: string,
  message: ThreadMessage,
) {
  utils.agent.threadMessages.setInfiniteData(threadMessagesQueryInput(threadId), (current) => {
    if (!current?.pages.length) {
      return {
        pages: [{ messages: [message], nextCursor: null }],
        pageParams: [null],
      };
    }

    return {
      ...current,
      pages: current.pages.map((page, index) =>
        index === 0 ? { ...page, messages: [...page.messages, message] } : page,
      ),
    };
  });
}

function removeOptimisticFromThread(
  utils: ReturnType<typeof trpc.useUtils>,
  threadId: string,
  optimisticId: string,
) {
  utils.agent.threadMessages.setInfiniteData(threadMessagesQueryInput(threadId), (current) => {
    if (!current) return current;
    return {
      ...current,
      pages: current.pages.map((page) => ({
        ...page,
        messages: page.messages.filter((message) => message.id !== optimisticId),
      })),
    };
  });
}

const QUICK_ACTIONS = [
  { label: "Summarize", icon: FileText, prompt: "Summarize the key risks in the selected report." },
  { label: "Draft", icon: PenLine, prompt: "Draft a concise response to the selected email." },
  {
    label: "Rewrite",
    icon: Repeat,
    prompt: "Rewrite the selected text to be clearer and more professional.",
  },
] as const;

/** Mirror the server's persisted user content so the optimistic bubble dedupes cleanly. */
function buildDisplayUserContent(text: string, files: AttachedAgentFile[]): string {
  if (files.length === 0) return text;
  const attachmentLines = formatAttachedFilenames(files.map((file) => file.filename));
  return text ? `${text}\n\n${attachmentLines}` : attachmentLines;
}

function pendingUserVisible(
  pendingUser: string | null,
  messages: { role: string; content: string }[] | undefined,
) {
  if (!pendingUser) return false;
  return !messages?.some((m) => m.role === "user" && m.content === pendingUser);
}

function shouldUseLocalAttachmentPreviews(
  message: ThreadMessage,
  pendingUser: string | null,
  attachmentPreviewAnchor: string | null,
) {
  if (message.role !== "user" || (message.imageUrl?.length ?? 0) > 0) return false;
  return (
    message.id.startsWith("optimistic-") ||
    (pendingUser !== null && message.content === pendingUser) ||
    (attachmentPreviewAnchor !== null && message.content === attachmentPreviewAnchor)
  );
}

function scheduleAttachmentUrlRefresh(
  utils: ReturnType<typeof trpc.useUtils>,
  threadId: string,
  onSettled?: () => void,
) {
  window.setTimeout(() => {
    void utils.agent.threadMessages
      .invalidate(threadMessagesQueryInput(threadId))
      .finally(onSettled);
  }, 35_000);
}

function clearAttachmentPreviewState(
  setInflight: React.Dispatch<React.SetStateAction<ChatAttachmentPreview[]>>,
  setAnchor: React.Dispatch<React.SetStateAction<string | null>>,
) {
  setInflight([]);
  setAnchor(null);
}

/** Transcript — paginated server messages plus optimistic in-flight user turn. */
function Transcript({
  threadId,
  pendingUser,
  isBusy,
  streamingAssistant,
  streamingApprovalIds,
  errorMessage,
  scrollRef,
  inflightAttachmentPreviews,
  attachmentPreviewAnchor,
  onAttachmentUrlsReady,
}: {
  threadId: string | null;
  pendingUser: string | null;
  isBusy: boolean;
  streamingAssistant: string | null;
  streamingApprovalIds: string[];
  errorMessage: string | null;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  inflightAttachmentPreviews: ChatAttachmentPreview[];
  attachmentPreviewAnchor: string | null;
  onAttachmentUrlsReady: () => void;
}) {
  const {
    data,
    isPending,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = agentThreadMessages(threadId);

  const messages = useMemo(() => {
    if (!data?.pages.length) return [];
    // Page 0 is the newest batch; later pages are progressively older.
    return [...data.pages].reverse().flatMap((page) => page.messages);
  }, [data]);
  const showPendingUser = pendingUserVisible(pendingUser, messages);

  const stickToBottomRef = useRef(true);
  const loadingOlderRef = useRef(false);

  useEffect(() => {
    stickToBottomRef.current = true;
  }, [threadId]);

  useEffect(() => {
    if (!attachmentPreviewAnchor) return;
    const matched = messages.find(
      (message) =>
        message.role === "user" &&
        message.content === attachmentPreviewAnchor &&
        (message.imageUrl?.length ?? 0) > 0,
    );
    if (matched) onAttachmentUrlsReady();
  }, [attachmentPreviewAnchor, messages, onAttachmentUrlsReady]);

  useEffect(() => {
    if (loadingOlderRef.current || !stickToBottomRef.current) return;
    requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }),
    );
  }, [
    messages.length,
    pendingUser,
    isBusy,
    streamingAssistant,
    streamingApprovalIds,
    errorMessage,
    scrollRef,
  ]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !threadId) return;

    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      stickToBottomRef.current = distanceFromBottom < 120;

      if (el.scrollTop > 80 || !hasNextPage || isFetchingNextPage || loadingOlderRef.current) {
        return;
      }

      loadingOlderRef.current = true;
      const previousHeight = el.scrollHeight;

      void fetchNextPage()
        .then(() => {
          requestAnimationFrame(() => {
            const container = scrollRef.current;
            if (container) {
              container.scrollTop = container.scrollHeight - previousHeight;
            }
          });
        })
        .finally(() => {
          loadingOlderRef.current = false;
        });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [threadId, hasNextPage, isFetchingNextPage, fetchNextPage, scrollRef]);

  const showInitialLoading =
    threadId !== null && isPending && !messages.length && !showPendingUser && !isBusy;

  return (
    <>
      {!threadId && !pendingUser && !errorMessage && (
        <div className="rounded-2xl rounded-tl-sm bg-secondary px-4 py-3 text-sm text-foreground">
          Hello. Ask me to summarize, draft, or rewrite — or anything about your inbox.
        </div>
      )}
      {showInitialLoading && <p className="text-sm text-muted-foreground">Loading conversation…</p>}
      {isFetchingNextPage && (
        <p className="py-2 text-center text-xs text-muted-foreground">Loading earlier messages…</p>
      )}
      {messages
        .filter((m): m is typeof m & { role: "user" | "assistant" } =>
          m.role === "user" || m.role === "assistant",
        )
        .map((m) => (
          <ChatMessageBubble
            key={m.id}
            role={m.role}
            content={m.content}
            approvalId={m.approvalId}
            attachmentPreviews={
              m.role === "user"
                ? resolveMessageAttachmentPreviews({
                    content: m.content,
                    imageUrls: m.imageUrl,
                    localPreviews: shouldUseLocalAttachmentPreviews(
                      m,
                      pendingUser,
                      attachmentPreviewAnchor,
                    )
                      ? inflightAttachmentPreviews
                      : undefined,
                  })
                : undefined
            }
          />
        ))}
      {showPendingUser && pendingUser && (
        <ChatMessageBubble
          role="user"
          content={pendingUser}
          attachmentPreviews={resolveMessageAttachmentPreviews({
            content: pendingUser,
            localPreviews: inflightAttachmentPreviews,
          })}
        />
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
  const [attachedFiles, setAttachedFiles] = useState<AttachedAgentFile[]>([]);
  const [inflightAttachmentPreviews, setInflightAttachmentPreviews] = useState<
    ChatAttachmentPreview[]
  >([]);
  const [attachmentPreviewAnchor, setAttachmentPreviewAnchor] = useState<string | null>(null);

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
      await utils.agent.threadMessages.invalidate(threadMessagesQueryInput(id));
    }
    return id;
  }

  async function consumeAgentStream(
    stream: AsyncIterable<AgentStreamEventModelType>,
    activeThreadId: string | null,
    optimisticId: string,
    hadAttachments: boolean,
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
      removeOptimisticFromThread(utils, activeThreadId, optimisticId);
    }

    if (resolvedThreadId) {
      await utils.agent.threadMessages.invalidate(threadMessagesQueryInput(resolvedThreadId));
      await utils.agent.listThreads.invalidate();
      if (hadAttachments) {
        scheduleAttachmentUrlRefresh(utils, resolvedThreadId, () => {
          clearAttachmentPreviewState(setInflightAttachmentPreviews, setAttachmentPreviewAnchor);
        });
      } else {
        clearAttachmentPreviewState(setInflightAttachmentPreviews, setAttachmentPreviewAnchor);
      }
      setPendingUser(null);
      setStreamingAssistant(null);
      setStreamingApprovalIds([]);
    }
  }

  async function send(prompt: string, files: AttachedAgentFile[] = attachedFiles) {
    const text = prompt.trim();
    if ((!text && files.length === 0) || isBusy) return;

    agentAbort.abort();
    agentAbort.set(new AbortController());

    setInput("");
    const localPreviews = toChatAttachmentPreviews(files);
    setAttachedFiles([]);
    setInflightAttachmentPreviews(localPreviews);
    const displayUser = buildDisplayUserContent(text, files);
    setAttachmentPreviewAnchor(files.length > 0 ? displayUser : null);
    setPendingUser(displayUser);
    setStreamingAssistant(null);
    setStreamingApprovalIds([]);
    setErrorMessage(null);

    const activeThreadId = threadId;
    const optimisticId = `optimistic-${Date.now()}`;

    if (activeThreadId) {
      appendToLatestThreadPage(utils, activeThreadId, {
        id: optimisticId,
        threadId: activeThreadId,
        role: "user",
        content: displayUser,
        approvalId: null,
        imageUrl: null,
        createdAt: new Date().toISOString(),
      });
    }

    try {
      const stream = await mutateAsync({
        prompt: text,
        threadId: activeThreadId ?? undefined,
        files: files.length > 0 ? files : undefined,
      });
      await consumeAgentStream(stream, activeThreadId, optimisticId, files.length > 0);
    } catch (e) {
      if (isAbortError(e)) {
        if (activeThreadId) {
          removeOptimisticFromThread(utils, activeThreadId, optimisticId);
        }
        toast.message("Stopped");
        setStreamingAssistant(null);
        setStreamingApprovalIds([]);
        await syncThreadMessages(activeThreadId);
        clearAttachmentPreviewState(setInflightAttachmentPreviews, setAttachmentPreviewAnchor);
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
        removeOptimisticFromThread(utils, activeThreadId, optimisticId);
      }
      clearAttachmentPreviewState(setInflightAttachmentPreviews, setAttachmentPreviewAnchor);
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

  async function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;

    const { attached, errors } = await readFilesAsBase64(picked, attachedFiles);

    // Clear only after reading, so the File handles stay valid and the same
    // selection can be picked again later.
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (attached.length > 0) {
      setAttachedFiles((prev) => [...prev, ...attached]);
    }
    for (const message of errors) {
      toast.error(message);
    }
  }

  function removeAttachedFile(index: number) {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
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
          inflightAttachmentPreviews={inflightAttachmentPreviews}
          attachmentPreviewAnchor={attachmentPreviewAnchor}
          onAttachmentUrlsReady={() =>
            clearAttachmentPreviewState(setInflightAttachmentPreviews, setAttachmentPreviewAnchor)
          }
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
            {attachedFiles.length > 0 && (
              <ChatAttachmentPreviews
                items={toChatAttachmentPreviews(attachedFiles)}
                onRemove={removeAttachedFile}
                className="mb-2"
              />
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
                multiple
                accept={AGENT_FILE_ACCEPT}
                className="hidden"
                onChange={onFilesSelected}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Attach files"
                    disabled={isBusy || attachedFiles.length >= MAX_FILES_PER_MESSAGE}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="size-4 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Attach up to {MAX_FILES_PER_MESSAGE} files — pdf, image, Word, or spreadsheet
                  </p>
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
                  disabled={!input.trim() && attachedFiles.length === 0}
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
