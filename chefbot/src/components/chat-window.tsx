"use client";

import { memo, useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "@/components/message-bubble";
import { WelcomeScreen } from "@/components/welcome-screen";
import type { Message } from "@/types";

interface ChatWindowProps {
  messages: Message[];
  isLoading: boolean;
  onSuggest?: (text: string) => void;
}

function ChatWindowInner({ messages, isLoading, onSuggest }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
    return () => cancelAnimationFrame(id);
  }, [messages]);

  return (
    <ScrollArea className="flex-1 px-4">
      <div className="flex flex-col gap-4 py-4">
        {messages.length === 0 && <WelcomeScreen onSuggest={onSuggest} />}
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isLoading={isLoading && message.role === "assistant" && message.content === ""}
            onSuggest={onSuggest}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}

export const ChatWindow = memo(ChatWindowInner);
