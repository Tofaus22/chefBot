"use client";

import { memo, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Pin, MessageSquare, MoreHorizontal, Globe } from "lucide-react";
import type { Conversation } from "@/types";

interface ConversationItemProps {
  conv: Conversation;
  isActive: boolean;
  isShared?: boolean;
  renamingId: string | null;
  renameValue: string;
  onSelect: (id: string) => void;
  onMenuOpen: (conv: Conversation, e: React.MouseEvent) => void;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onRenameKeyDown: (e: React.KeyboardEvent) => void;
}

function ConversationItemInner({
  conv, isActive, isShared = false, renamingId, renameValue,
  onSelect, onMenuOpen, onRenameChange, onRenameCommit, onRenameKeyDown,
}: ConversationItemProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isRenaming = renamingId === conv.id;

  useEffect(() => {
    if (isRenaming) inputRef.current?.focus();
  }, [isRenaming]);

  return (
    <div
      style={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
      className={cn(
        "group relative flex items-center rounded-md px-2 py-1.5 text-sm transition-colors cursor-pointer select-none",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
      onClick={() => !isRenaming && onSelect(conv.id)}
    >
      <span className="shrink-0 mr-2 opacity-60">
        {conv.pinned
          ? <Pin className="h-3.5 w-3.5" />
          : <MessageSquare className="h-3.5 w-3.5" />
        }
      </span>

      {isRenaming ? (
        <input
          ref={inputRef}
          value={renameValue}
          onChange={(e) => onRenameChange(e.target.value)}
          onBlur={onRenameCommit}
          onKeyDown={onRenameKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 bg-background border border-ring rounded px-1.5 py-0.5 text-sm text-foreground outline-none"
        />
      ) : (
        <>
          <span style={{
            flex: "1 1 0%",
            minWidth: 0,
            width: 0,
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          }}>
            {conv.title}
          </span>

          {isShared && (
            <span
              title="Conversación compartida"
              className="shrink-0 text-sky-500 ml-1"
              aria-label="Conversación compartida"
            >
              <Globe className="h-3.5 w-3.5" />
            </span>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); onMenuOpen(conv, e); }}
            style={{ flexShrink: 0 }}
            className={cn(
              "h-6 w-6 flex items-center justify-center rounded ml-1",
              "opacity-0 group-hover:opacity-100 transition-opacity",
              isActive ? "hover:bg-white/20" : "hover:bg-muted"
            )}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

export const ConversationItem = memo(ConversationItemInner);
