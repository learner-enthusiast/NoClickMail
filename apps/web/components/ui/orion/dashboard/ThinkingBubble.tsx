"use client";

import { useEffect, useState } from "react";
import { Bubble, BubbleContent } from "~/components/ui/bubble";
import { Message, MessageContent } from "~/components/ui/message";
import { Loader } from "~/components/ui/loader";
import { Skeleton } from "~/components/ui/skeleton";

const STEPS = [
  "Reading your message…",
  "Searching inbox context…",
  "Checking calendar…",
  "Calling Corsair tools…",
  "Drafting a response…",
] as const;

export function ThinkingBubble() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setStep((s) => (s + 1) % STEPS.length);
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <Message align="start">
      <MessageContent>
        <Bubble variant="secondary" align="start">
          <BubbleContent>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader className="text-primary" />
              <span className="text-sm">{STEPS[step]}</span>
            </div>
            {/* Optional Claude-style shimmer lines */}
            <div className="mt-2 space-y-1">
              <Skeleton className="h-2 w-40" />
              <Skeleton className="h-2 w-28" />
            </div>
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}
