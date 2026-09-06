"use client";

import { use } from "react";
import { ChatWorkspace } from "~/components/ui/orion/chat/ChatWorkspace";

export default function ChatThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ChatWorkspace threadId={id} />;
}
