"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquarePlus, PanelLeftClose, PanelLeftOpen, Sparkles } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { MOCK_CHAT_THREADS } from "./mock-data";

type ChatSidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

function formatRelativeTime(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function ChatSidebar({ collapsed, onToggleCollapsed }: ChatSidebarProps) {
  const pathname = usePathname();
  const activeId = pathname.startsWith("/chat/") ? pathname.split("/chat/")[1] : null;

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-[280px]",
      )}
    >
      <div className="flex items-center gap-2 border-b border-sidebar-border p-3">
        {!collapsed && (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-accent">
              <Sparkles className="size-4 text-accent-foreground" />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-bold text-foreground">Orion Chat</p>
              <p className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                Conversations
              </p>
            </div>
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggleCollapsed}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
      </div>

      <div className="p-2">
        <Button
          asChild
          variant="secondary"
          className={cn("w-full justify-start gap-2", collapsed && "px-0 justify-center")}
        >
          <Link href="/chat/new" title="New chat">
            <MessageSquarePlus className="size-4 shrink-0" />
            {!collapsed && <span>New chat</span>}
          </Link>
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {!collapsed && (
          <p className="px-2 py-2 text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
            Recent
          </p>
        )}

        <nav className="flex flex-col gap-1">
          {MOCK_CHAT_THREADS.map((thread) => {
            const active = activeId === thread.id;

            return (
              <Link
                key={thread.id}
                href={`/chat/${thread.id}`}
                title={thread.title}
                className={cn(
                  "group rounded-lg border border-transparent px-2 py-2 transition-colors hover:bg-sidebar-accent",
                  active && "border-border bg-sidebar-accent",
                  collapsed && "flex justify-center px-1",
                )}
              >
                {collapsed ? (
                  <span className="flex size-9 items-center justify-center rounded-md bg-muted text-xs font-bold text-primary">
                    {thread.title.charAt(0)}
                  </span>
                ) : (
                  <span className="block min-w-0">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {thread.title}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {formatRelativeTime(thread.updatedAt)}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {thread.preview}
                    </span>
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
