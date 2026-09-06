import * as React from "react";

import { cn } from "~/lib/utils";

function PromptInput({ className, ...props }: React.ComponentProps<"form">) {
  return (
    <form
      data-slot="prompt-input"
      className={cn(
        "mx-auto w-full max-w-3xl rounded-2xl border border-border bg-card p-2 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

function PromptInputBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="prompt-input-body"
      className={cn("flex min-h-[52px] flex-col gap-2", className)}
      {...props}
    />
  );
}

function PromptInputTextarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="prompt-input-textarea"
      className={cn(
        "max-h-40 min-h-[44px] w-full resize-none bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function PromptInputToolbar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="prompt-input-toolbar"
      className={cn("flex items-center justify-between gap-2 px-1 pb-1", className)}
      {...props}
    />
  );
}

function PromptInputTools({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="prompt-input-tools"
      className={cn("flex min-w-0 flex-1 items-center gap-1", className)}
      {...props}
    />
  );
}

function PromptInputActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="prompt-input-actions"
      className={cn("flex shrink-0 items-center gap-2", className)}
      {...props}
    />
  );
}

export {
  PromptInput,
  PromptInputActions,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
};
