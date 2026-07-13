"use client";

import { memo, useState, useEffect, useRef, useCallback, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Square, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface InputBarProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  onStop?: () => void;
  editingText?: string | null;
  onCancelEdit?: () => void;
  onSubmitEdit?: (text: string) => void;
}

function InputBarInner({
  onSend,
  isLoading,
  onStop,
  editingText,
  onCancelEdit,
  onSubmitEdit,
}: InputBarProps) {
  const isEditing = editingText !== null && editingText !== undefined && !!onSubmitEdit;

  const [value, setValue] = useState("");
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setEditValue(editingText ?? "");
      requestAnimationFrame(() => editRef.current?.focus());
    }
  }, [isEditing, editingText]);

  const handleSend = useCallback(() => {
    if (!value.trim() || isLoading) return;
    onSend(value.trim());
    setValue("");
    inputRef.current?.focus();
  }, [value, isLoading, onSend]);

  const handleSubmitEdit = useCallback(() => {
    const t = editValue.trim();
    if (!t || isLoading) return;
    onSubmitEdit?.(t);
  }, [editValue, isLoading, onSubmitEdit]);

  const handleCancelEdit = useCallback(() => {
    onCancelEdit?.();
  }, [onCancelEdit]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleEditKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmitEdit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancelEdit();
      }
    },
    [handleSubmitEdit, handleCancelEdit]
  );

  if (isEditing) {
    return (
      <div className="flex flex-col gap-2 p-4 border-t border-border bg-background">
        <div className="flex items-center gap-2 text-xs text-amber-500">
          <Pencil className="h-3 w-3" />
          <span>Editando mensaje — la respuesta se regenerará al reenviar</span>
          <button
            onClick={handleCancelEdit}
            className="ml-auto text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Cancelar
          </button>
        </div>
        <div className="flex gap-2">
          <Input
            ref={editRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleEditKeyDown}
            placeholder="Edita tu mensaje..."
            disabled={isLoading}
            className="flex-1 bg-secondary border-secondary focus-visible:ring-primary"
          />
          <Button
            onClick={handleSubmitEdit}
            disabled={isLoading || !editValue.trim()}
            size="icon"
            className="shrink-0"
            title="Reenviar (Enter)"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

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
