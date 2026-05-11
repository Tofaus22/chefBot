"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "@/components/message-bubble";
import type { Message } from "@/types";

interface ChatWindowProps {
  messages: Message[];
  isLoading: boolean;
  onSuggest?: (text: string) => void;
}

const STARTER_SUGGESTIONS = [
  "🍝 Receta de pasta carbonara",
  "🥑 ¿Cómo hacer guacamole?",
  "🍰 Receta de tiramisú",
  "🍗 Pollo al horno fácil",
  "🥗 Ensalada mediterránea",
  "🍜 Ramen casero",
];

export function ChatWindow({ messages, isLoading, onSuggest }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <ScrollArea className="flex-1 px-4">
      <div className="flex flex-col gap-4 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
            <span className="text-6xl">👨‍🍳</span>
            <h2 className="text-xl font-semibold text-foreground">
              ¡Hola! Soy ChefBot
            </h2>
            <p className="text-muted-foreground text-sm max-w-sm">
              Tu asistente culinario personal. Pregúntame sobre recetas,
              técnicas de cocina, ingredientes o planificación de menús.
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {STARTER_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => onSuggest?.(suggestion)}
                  className="text-xs bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground px-3 py-1.5 rounded-full border border-border transition-colors cursor-pointer"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

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
