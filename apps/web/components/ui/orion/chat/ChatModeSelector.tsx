"use client";

import { AudioLines, MessageSquare, Radio, type LucideIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import type { ChatMode } from "./types";

export const CHAT_MODES: {
  id: ChatMode;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    id: "text-to-text",
    label: "Text → Text",
    description: "Type prompts, read replies",
    icon: MessageSquare,
  },
  {
    id: "text-to-voice",
    label: "Text → Voice",
    description: "Type prompts, hear replies",
    icon: AudioLines,
  },
  {
    id: "voice-to-voice",
    label: "Voice → Voice",
    description: "Full spoken conversation",
    icon: Radio,
  },
];

type ChatModeSelectorProps = {
  value: ChatMode;
  onChange: (mode: ChatMode) => void;
  compact?: boolean;
};

export function ChatModeSelector({ value, onChange, compact = false }: ChatModeSelectorProps) {
  return (
    <div
      className={cn(
        "grid gap-2",
        compact ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-3",
      )}
    >
      {CHAT_MODES.map(({ id, label, description, icon: Icon }) => {
        const active = value === id;

        return (
          <Button
            key={id}
            type="button"
            variant={active ? "default" : "outline"}
            className={cn(
              "h-auto min-h-11 justify-start gap-3 px-3 py-2.5 text-left",
              active && "ring-2 ring-ring/30",
            )}
            onClick={() => onChange(id)}
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                active ? "bg-primary-foreground/15" : "bg-muted",
              )}
            >
              <Icon className={cn("size-4", active ? "text-primary-foreground" : "text-primary")} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{label}</span>
              {!compact && (
                <span
                  className={cn(
                    "block truncate text-xs font-normal",
                    active ? "text-primary-foreground/80" : "text-muted-foreground",
                  )}
                >
                  {description}
                </span>
              )}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
