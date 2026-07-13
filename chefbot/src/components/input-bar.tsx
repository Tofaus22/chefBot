"use client";

import { memo, useState, useRef, useCallback, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface InputBarProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  onStop?: () => void;
}

function InputBarInner({ onSend, isLoading, onStop }: InputBarProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(() => {
    if (!value.trim() || isLoading) return;
    onSend(value.trim());
    setValue("");
    inputRef.current?.focus();
  }, [value, isLoading, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="flex gap-2 p-4 border-t border-border bg-background">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Pregunta a ChefBot... (ej: ¿cómo hago pasta boloñesa?)"
        disabled={isLoading}
        className="flex-1 bg-secondary border-secondary focus-visible:ring-primary"
      />
      {isLoading && onStop ? (
        <Button
          onClick={onStop}
          variant="destructive"
          size="icon"
          className="shrink-0"
          title="Detener"
        >
          <Square className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          onClick={handleSend}
          disabled={isLoading || !value.trim()}
          size="icon"
          className={cn("shrink-0")}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  );
}

export const InputBar = memo(InputBarInner);
