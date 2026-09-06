"use client";

import { useState } from "react";
import { ChatSidebar } from "./ChatSidebar";

export function ChatShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-background">
      <ChatSidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((value) => !value)} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
