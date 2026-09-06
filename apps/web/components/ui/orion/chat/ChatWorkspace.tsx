"use client";

import { useMemo, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { getMessagesByThreadId, getThreadById } from "./mock-data";
import { ChatComposer } from "./ChatComposer";
import { ChatMessages } from "./ChatMessages";
import { CHAT_MODES } from "./ChatModeSelector";
import type { ChatMode } from "./types";

type ChatWorkspaceProps = {
  threadId?: string;
};

export function ChatWorkspace({ threadId }: ChatWorkspaceProps) {
  const thread = threadId ? getThreadById(threadId) : undefined;
  const messages = useMemo(
    () => (threadId && threadId !== "new" ? getMessagesByThreadId(threadId) : []),
    [threadId],
  );

  const [mode, setMode] = useState<ChatMode>(thread?.mode ?? "text-to-text");
  const modeMeta = CHAT_MODES.find((item) => item.id === mode);

  const title =
    threadId === "new" ? "New chat" : (thread?.title ?? "Conversation not found");
  const subtitle =
    threadId === "new"
      ? "Pick a mode and start typing when backend is ready."
      : (thread?.preview ?? "This conversation is not in the mock list yet.");

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-headline-sm text-foreground">{title}</h1>
          <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {modeMeta && (
          <Badge variant="secondary" className="shrink-0 gap-1.5 px-2.5 py-1">
            <modeMeta.icon className="size-3.5" />
            {modeMeta.label}
          </Badge>
        )}
      </header>

      <ChatMessages
        messages={messages}
        emptyTitle={threadId === "new" ? "New Orion chat" : "No messages yet"}
        emptyDescription={
          threadId === "new"
            ? "This is a fresh thread. Select text or voice mode, then compose below."
            : "Mock data has not been added for this thread yet."
        }
      />

      <ChatComposer
        mode={mode}
        onModeChange={setMode}
        showModePicker={!threadId || threadId === "new"}
      />
    </div>
  );
}
