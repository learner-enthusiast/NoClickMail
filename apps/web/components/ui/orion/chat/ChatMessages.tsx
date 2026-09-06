"use client";

import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Bubble, BubbleContent, BubbleGroup } from "~/components/ui/bubble";
import { Conversation, ConversationContent, ConversationEmpty } from "~/components/ui/conversation";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageGroup,
  MessageHeader,
} from "~/components/ui/message";
import type { ChatMessage } from "./types";

type ChatMessagesProps = {
  messages: ChatMessage[];
  emptyTitle?: string;
  emptyDescription?: string;
};

export function ChatMessages({
  messages,
  emptyTitle = "Start a conversation",
  emptyDescription = "Choose a mode below and send your first message to Orion.",
}: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  return (
    <Conversation>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <ConversationContent className="h-full">
        {messages.length === 0 ? (
          <ConversationEmpty>
            <div className="flex size-14 items-center justify-center rounded-2xl bg-accent">
              <Sparkles className="size-7 text-accent-foreground" />
            </div>
            <div className="space-y-1">
              <h2 className="text-headline-sm text-foreground">{emptyTitle}</h2>
              <p className="max-w-md text-sm text-muted-foreground">{emptyDescription}</p>
            </div>
          </ConversationEmpty>
        ) : (
          <MessageGroup className="mx-auto w-full max-w-3xl gap-6">
            {messages.map((message) => (
              <Message key={message.id} align={message.role === "user" ? "end" : "start"}>
                {message.role === "assistant" && (
                  <MessageAvatar>
                    <Avatar className="size-8 border border-border bg-accent">
                      <AvatarFallback className="bg-accent text-accent-foreground">
                        <Sparkles className="size-4" />
                      </AvatarFallback>
                    </Avatar>
                  </MessageAvatar>
                )}

                <MessageContent>
                  {message.role === "assistant" && (
                    <MessageHeader>Orion</MessageHeader>
                  )}

                  <BubbleGroup>
                    <Bubble
                      align={message.role === "user" ? "end" : "start"}
                      variant={message.role === "user" ? "default" : "secondary"}
                    >
                      <BubbleContent>
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </BubbleContent>
                    </Bubble>
                  </BubbleGroup>
                </MessageContent>
              </Message>
            ))}
          </MessageGroup>
        )}
        </ConversationContent>
      </div>
    </Conversation>
  );
}
