import * as React from "react";

import { cn } from "~/lib/utils";

function Conversation({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="conversation"
      className={cn("relative flex min-h-0 flex-1 flex-col", className)}
      {...props}
    />
  );
}

function ConversationContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="conversation-content"
      className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-6", className)}
      {...props}
    />
  );
}

function ConversationEmpty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="conversation-empty"
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center",
        className,
      )}
      {...props}
    />
  );
}

export { Conversation, ConversationContent, ConversationEmpty };
