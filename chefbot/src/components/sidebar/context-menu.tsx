"use client";

import { useEffect, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Share2, Pencil, Pin, PinOff, Trash2, GlobeOff,
} from "lucide-react";
import type { Conversation } from "@/types";

interface ContextMenuProps {
  conv: Conversation;
  position: { x: number; y: number };
  isShared?: boolean;
  onClose: () => void;
  onRename: (conv: Conversation) => void;
  onDelete: (conv: Conversation) => void;
  onTogglePin: (conv: Conversation) => void;
  onShare: (conv: Conversation) => void;
  onRevoke?: (conv: Conversation) => void;
}

export function ContextMenu({
  conv, position, isShared = false,
  onClose, onRename, onDelete, onTogglePin, onShare, onRevoke,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const style = useMemo<React.CSSProperties>(
    () => ({
      position: "fixed",
      top: Math.min(position.y, window.innerHeight - 220),
      left: Math.min(position.x, window.innerWidth - 200),
      zIndex: 9999,
    }),
    [position.x, position.y]
  );

  const item = "flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-md transition-colors text-left";

  return (
    <div
      ref={menuRef}
      style={style}
      className="w-48 bg-popover border border-border rounded-lg shadow-xl py-1 overflow-hidden"
    >
      <button
        onClick={() => { onShare(conv); onClose(); }}
        className={cn(item, "text-foreground hover:bg-accent")}
      >
        <Share2 className="h-4 w-4 text-muted-foreground" />
        {isShared ? "Compartir de nuevo" : "Compartir"}
      </button>
      {isShared && onRevoke && (
        <button
          onClick={() => { onRevoke(conv); onClose(); }}
          className={cn(item, "text-foreground hover:bg-accent")}
        >
          <GlobeOff className="h-4 w-4 text-muted-foreground" /> Dejar de compartir
        </button>
      )}
      <button
        onClick={() => { onRename(conv); onClose(); }}
        className={cn(item, "text-foreground hover:bg-accent")}
      >
        <Pencil className="h-4 w-4 text-muted-foreground" /> Cambiar nombre
      </button>
      <button
        onClick={() => { onTogglePin(conv); onClose(); }}
        className={cn(item, "text-foreground hover:bg-accent")}
      >
        {conv.pinned
          ? <><PinOff className="h-4 w-4 text-muted-foreground" /> Desanclar</>
          : <><Pin className="h-4 w-4 text-muted-foreground" /> Anclar chat</>
        }
      </button>
      <div className="border-t border-border my-1" />
      <button
        onClick={() => { onDelete(conv); onClose(); }}
        className={cn(item, "text-destructive hover:bg-destructive/10")}
      >
        <Trash2 className="h-4 w-4" /> Eliminar
      </button>
    </div>
  );
}
