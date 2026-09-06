"use client";

import { useState } from "react";
import { Mic, Paperclip, Send } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  PromptInput,
  PromptInputActions,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "~/components/ui/prompt-input";
import { ChatModeSelector } from "./ChatModeSelector";
import type { ChatMode } from "./types";

type ChatComposerProps = {
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  showModePicker?: boolean;
};

export function ChatComposer({ mode, onModeChange, showModePicker = true }: ChatComposerProps) {
  const [input, setInput] = useState("");
  const usesVoiceInput = mode === "voice-to-voice";
  const usesVoiceOutput = mode === "text-to-voice" || mode === "voice-to-voice";

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setInput("");
  }

  return (
    <div className="border-t border-border bg-background/80 px-4 py-4 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
        {showModePicker && (
          <div className="rounded-xl border border-border bg-card/60 p-2">
            <p className="mb-2 px-1 text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
              Conversation mode
            </p>
            <ChatModeSelector value={mode} onChange={onModeChange} compact />
          </div>
        )}

        <PromptInput onSubmit={onSubmit}>
          <PromptInputBody>
            <PromptInputTextarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={
                usesVoiceInput
                  ? "Tap the mic to speak, or type a fallback prompt…"
                  : "Message Orion…"
              }
              rows={3}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  onSubmit(event);
                }
              }}
            />
          </PromptInputBody>

          <PromptInputToolbar>
            <PromptInputTools>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Attach file">
                <Paperclip className="size-4 text-muted-foreground" />
              </Button>
              {usesVoiceInput && (
                <Button type="button" variant="outline" size="sm" className="gap-1.5">
                  <Mic className="size-4" />
                  Hold to talk
                </Button>
              )}
            </PromptInputTools>

            <PromptInputActions>
              <span className="hidden text-[10px] text-muted-foreground sm:inline">
                {usesVoiceOutput ? "Voice replies enabled" : "Text replies"}
              </span>
              <Button type="submit" size="icon-sm" disabled={!input.trim()} aria-label="Send message">
                <Send className="size-4" />
              </Button>
            </PromptInputActions>
          </PromptInputToolbar>
        </PromptInput>

        <p className="text-center text-[11px] text-muted-foreground">
          UI preview only — messaging backend coming soon.
        </p>
      </div>
    </div>
  );
}
