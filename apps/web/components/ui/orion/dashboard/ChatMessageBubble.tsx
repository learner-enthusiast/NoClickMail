"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { toast } from "sonner";
import { ChatMarkdown } from "./ChatMarkdown";

const USER_COLLAPSED_CHAR_LIMIT = 320;

async function copyText(text: string, label = "Copied to clipboard") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error("Could not copy to clipboard");
  }
}

function CopyButton({
  text,
  label,
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label="Copy message"
      className={cn(
        "size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100",
        className,
      )}
      onClick={async (event) => {
        event.stopPropagation();
        await copyText(text, label);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

function UserMessageBody({
  content,
  expanded,
  onToggle,
}: {
  content: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const needsTruncate = content.length > USER_COLLAPSED_CHAR_LIMIT;
  const display =
    !expanded && needsTruncate ? `${content.slice(0, USER_COLLAPSED_CHAR_LIMIT)}…` : content;

  return (
    <button
      type="button"
      onClick={needsTruncate ? onToggle : undefined}
      disabled={!needsTruncate}
      className={cn(
        "w-full text-left",
        needsTruncate && "cursor-pointer",
        expanded && needsTruncate && "max-h-48 overflow-y-auto pr-1",
      )}
    >
      <p className="whitespace-pre-wrap leading-relaxed">{display}</p>
      {needsTruncate && !expanded && (
        <span className="mt-1 block text-xs text-primary-foreground/75">Click to expand</span>
      )}
    </button>
  );
}

export function ChatMessageBubble({
  role,
  content,
  approvalId,
}: {
  role: "user" | "assistant";
  content: string;
  approvalId?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "group relative max-w-[85%] rounded-2xl px-4 py-3 text-sm",
        isUser
          ? "ml-auto rounded-tr-sm bg-primary text-primary-foreground"
          : "mr-auto rounded-tl-sm bg-secondary text-foreground",
      )}
    >
      <div
        className={cn(
          "absolute top-1.5 flex gap-0.5",
          isUser ? "left-1.5" : "right-1.5",
        )}
      >
        {approvalId ? (
          <CopyButton
            text={approvalId}
            label="Approval ID copied"
            className={cn(isUser ? "text-primary-foreground hover:bg-primary-foreground/10" : "")}
          />
        ) : (
          <CopyButton
            text={content}
            className={cn(isUser ? "text-primary-foreground hover:bg-primary-foreground/10" : "")}
          />
        )}
      </div>

      <div className={cn("pt-1", isUser ? "pr-0 pl-6" : "pr-6 pl-0")}>
        {isUser ? (
          <UserMessageBody
            content={content}
            expanded={expanded}
            onToggle={() => setExpanded((value) => !value)}
          />
        ) : (
          <ChatMarkdown content={content} invert={false} />
        )}

        {approvalId && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              href={`/approval/${approvalId}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <ExternalLink className="size-3.5" />
              Review approval
            </Link>
            <span className="text-xs text-muted-foreground">ID: {approvalId.slice(0, 8)}…</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatErrorBubble({ message }: { message: string }) {
  return (
    <div className="group relative mr-auto max-w-[85%] rounded-2xl rounded-tl-sm border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <div className="absolute top-1.5 right-1.5">
        <CopyButton text={message} className="text-destructive hover:bg-destructive/10" />
      </div>
      <p className="pr-6 whitespace-pre-wrap leading-relaxed">{message}</p>
    </div>
  );
}
