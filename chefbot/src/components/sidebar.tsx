"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Plus, MessageSquare, LogOut, ChefHat, Search, Sun, Moon,
  X, Menu, Heart, BookOpen, MoreHorizontal, Trash2, Pin,
  PinOff, Share2, Pencil, Check,
} from "lucide-react";
import type { Conversation } from "@/types";

interface FavoriteMessage {
  id: string;
  message_id: string;
  created_at: string;
  messages: { content: string; conversation_id: string } | null;
}

interface SidebarProps {
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

function groupByDate(conversations: Conversation[]): Record<string, Conversation[]> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 7);

  const groups: Record<string, Conversation[]> = {
    "Anclados": [],
    "Hoy": [],
    "Ayer": [],
    "Esta semana": [],
    "Anteriores": [],
  };

  for (const conv of conversations) {
    if (conv.pinned) { groups["Anclados"].push(conv); continue; }
    const d = new Date(conv.created_at);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (day >= today) groups["Hoy"].push(conv);
    else if (day >= yesterday) groups["Ayer"].push(conv);
    else if (day >= weekAgo) groups["Esta semana"].push(conv);
    else groups["Anteriores"].push(conv);
  }

  for (const key of Object.keys(groups)) {
    if (groups[key].length === 0) delete groups[key];
  }
  return groups;
}

// ─── Context menu ────────────────────────────────────────────────────────────
interface ContextMenuProps {
  conv: Conversation;
  position: { x: number; y: number };
  onClose: () => void;
  onRename: (conv: Conversation) => void;
  onDelete: (conv: Conversation) => void;
  onTogglePin: (conv: Conversation) => void;
  onShare: (conv: Conversation) => void;
}

function ContextMenu({ conv, position, onClose, onRename, onDelete, onTogglePin, onShare }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Adjust so menu never overflows the viewport
  const style: React.CSSProperties = {
    position: "fixed",
    top: Math.min(position.y, window.innerHeight - 220),
    left: Math.min(position.x, window.innerWidth - 200),
    zIndex: 9999,
  };

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
        <Share2 className="h-4 w-4 text-muted-foreground" /> Compartir
      </button>
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

// ─── Delete confirmation dialog ───────────────────────────────────────────────
function DeleteDialog({ title, onConfirm, onCancel }: { title: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
      <div className="bg-popover border border-border rounded-xl shadow-2xl p-5 w-80 flex flex-col gap-4">
        <div>
          <h3 className="font-semibold text-foreground text-sm mb-1">Eliminar conversación</h3>
          <p className="text-xs text-muted-foreground">
            ¿Eliminar <span className="font-medium text-foreground">&quot;{title}&quot;</span>? Esta acción no se puede deshacer.
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>Eliminar</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Share toast ──────────────────────────────────────────────────────────────
function ShareToast({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 bg-secondary border border-border text-foreground text-sm px-4 py-2.5 rounded-full shadow-lg">
      <Check className="h-4 w-4 text-green-500" />
      Enlace copiado al portapapeles
    </div>
  );
}

// ─── ConversationItem ─────────────────────────────────────────────────────────
interface ConversationItemProps {
  conv: Conversation;
  isActive: boolean;
  renamingId: string | null;
  renameValue: string;
  onSelect: (id: string) => void;
  onMenuOpen: (conv: Conversation, e: React.MouseEvent) => void;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onRenameKeyDown: (e: React.KeyboardEvent) => void;
}

function ConversationItem({
  conv, isActive, renamingId, renameValue,
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
      {/* Icon */}
      <span className="shrink-0 mr-2 opacity-60">
        {conv.pinned
          ? <Pin className="h-3.5 w-3.5" />
          : <MessageSquare className="h-3.5 w-3.5" />
        }
      </span>

      {/* Title */}
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

          {/* 3-dot button */}
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

// ─── Main Sidebar ─────────────────────────────────────────────────────────────
export function Sidebar({
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  isDark,
  onToggleTheme,
}: SidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"history" | "favorites">("history");
  const [favorites, setFavorites] = useState<FavoriteMessage[]>([]);

  // Context menu state
  const [menuConv, setMenuConv] = useState<Conversation | null>(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Delete state
  const [deleteConv, setDeleteConv] = useState<Conversation | null>(null);

  // Share toast
  const [showShareToast, setShowShareToast] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadConversations();
    loadUser();
    loadFavorites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (currentConversationId) {
      loadConversations();
      loadFavorites();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConversationId]);

  const loadConversations = async () => {
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .order("created_at", { ascending: false });
    setConversations(data || []);
  };

  const loadFavorites = async () => {
    const { data } = await supabase
      .from("favorites")
      .select("id, message_id, created_at, messages(content, conversation_id)")
      .order("created_at", { ascending: false });
    setFavorites((data as unknown as FavoriteMessage[]) || []);
  };

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserEmail(user?.email ?? null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  // ── Menu open ──────────────────────────────────────────────────────────────
  const handleMenuOpen = useCallback((conv: Conversation, e: React.MouseEvent) => {
    e.preventDefault();
    setMenuConv(conv);
    setMenuPos({ x: e.clientX, y: e.clientY });
  }, []);

  // ── Rename ─────────────────────────────────────────────────────────────────
  const startRename = useCallback((conv: Conversation) => {
    setRenamingId(conv.id);
    setRenameValue(conv.title);
  }, []);

  const commitRename = useCallback(async () => {
    if (!renamingId || !renameValue.trim()) { setRenamingId(null); return; }
    await supabase
      .from("conversations")
      .update({ title: renameValue.trim() })
      .eq("id", renamingId);
    setConversations((prev) =>
      prev.map((c) => c.id === renamingId ? { ...c, title: renameValue.trim() } : c)
    );
    setRenamingId(null);
  }, [renamingId, renameValue, supabase]);

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") setRenamingId(null);
  }, [commitRename]);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const confirmDelete = useCallback(async () => {
    if (!deleteConv) return;
    await supabase.from("conversations").delete().eq("id", deleteConv.id);
    setConversations((prev) => prev.filter((c) => c.id !== deleteConv.id));
    if (currentConversationId === deleteConv.id) onNewConversation();
    setDeleteConv(null);
  }, [deleteConv, supabase, currentConversationId, onNewConversation]);

  // ── Pin ────────────────────────────────────────────────────────────────────
  const handleTogglePin = useCallback(async (conv: Conversation) => {
    const next = !conv.pinned;
    await supabase.from("conversations").update({ pinned: next }).eq("id", conv.id);
    setConversations((prev) =>
      prev.map((c) => c.id === conv.id ? { ...c, pinned: next } : c)
    );
  }, [supabase]);

  // ── Share ──────────────────────────────────────────────────────────────────
  const handleShare = useCallback(async (conv: Conversation) => {
    const url = `${window.location.origin}/chat?id=${conv.id}`;
    await navigator.clipboard.writeText(url);
    setShowShareToast(true);
  }, []);

  // ── Select ─────────────────────────────────────────────────────────────────
  const handleSelect = (id: string) => {
    onSelectConversation(id);
    setOpen(false);
  };

  // ── Filtered / grouped ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    return conversations.filter((c) =>
      c.title.toLowerCase().includes(search.toLowerCase())
    );
  }, [conversations, search]);

  const filteredFavorites = useMemo(() => {
    if (!search.trim()) return favorites;
    return favorites.filter((f) =>
      f.messages?.content?.toLowerCase().includes(search.toLowerCase())
    );
  }, [favorites, search]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  // ── Sidebar inner content ──────────────────────────────────────────────────
  const sidebarContent = (
    <div className="w-64 shrink-0 flex flex-col h-full bg-secondary border-r border-border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ChefHat className="h-6 w-6 text-primary" />
            <h1 className="font-bold text-lg text-foreground">ChefBot</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={onToggleTheme}
              className="h-8 w-8 text-muted-foreground hover:text-foreground">
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground md:hidden">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Button onClick={onNewConversation} className="w-full gap-2 mb-3" variant="outline">
          <Plus className="h-4 w-4" /> Nueva conversación
        </Button>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "history" ? "Buscar recetas..." : "Buscar favoritos..."}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-2">
          <button
            onClick={() => { setTab("history"); setSearch(""); }}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md transition-colors",
              tab === "history" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-accent"
            )}>
            <BookOpen className="h-3 w-3" /> Historial
          </button>
          <button
            onClick={() => { setTab("favorites"); setSearch(""); }}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md transition-colors",
              tab === "favorites" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-accent"
            )}>
            <Heart className="h-3 w-3" /> Guardados
          </button>
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1 w-full">
        <div className="p-2 flex flex-col gap-0.5 w-full overflow-hidden">
          {tab === "history" ? (
            <>
              {Object.keys(groups).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6 px-2">
                  {search ? "Sin resultados." : "No hay conversaciones aún. ¡Empieza una nueva!"}
                </p>
              )}
              {Object.entries(groups).map(([label, convs]) => (
                <div key={label} className="mb-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1.5">
                    {label}
                  </p>
                  {convs.map((conv) => (
                    <ConversationItem
                      key={conv.id}
                      conv={conv}
                      isActive={currentConversationId === conv.id}
                      renamingId={renamingId}
                      renameValue={renameValue}
                      onSelect={handleSelect}
                      onMenuOpen={handleMenuOpen}
                      onRenameChange={setRenameValue}
                      onRenameCommit={commitRename}
                      onRenameKeyDown={handleRenameKeyDown}
                    />
                  ))}
                </div>
              ))}
            </>
          ) : (
            <>
              {filteredFavorites.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6 px-2">
                  {search ? "Sin resultados." : "Aún no guardaste recetas. Toca ♡ en cualquier respuesta."}
                </p>
              )}
              {filteredFavorites.map((fav) => {
                const snippet = fav.messages?.content
                  ?.replace(/#{1,3} /g, "")
                  ?.replace(/\*\*/g, "")
                  ?.replace(/<!--[\s\S]*?-->/g, "")
                  ?.slice(0, 58) ?? "Receta guardada";
                return (
                  <button key={fav.id}
                    onClick={() => fav.messages?.conversation_id && handleSelect(fav.messages.conversation_id)}
                    className="grid grid-cols-[auto_1fr] w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                    <Heart className="h-4 w-4 shrink-0 text-red-500 fill-current" />
                    <span className="truncate">{snippet}…</span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground truncate max-w-[150px]">{userEmail}</p>
          <Button variant="ghost" size="icon" onClick={handleLogout}
            className="h-8 w-8 text-muted-foreground hover:text-destructive">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 h-9 w-9 bg-secondary border border-border shadow">
        <Menu className="h-4 w-4" />
      </Button>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Mobile drawer */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 transition-transform duration-300 md:hidden",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        {sidebarContent}
      </div>

      {/* Desktop */}
      <div className="hidden md:flex">{sidebarContent}</div>

      {/* Context menu (portal-like, rendered at root) */}
      {menuConv && (
        <ContextMenu
          conv={menuConv}
          position={menuPos}
          onClose={() => setMenuConv(null)}
          onRename={startRename}
          onDelete={setDeleteConv}
          onTogglePin={handleTogglePin}
          onShare={handleShare}
        />
      )}

      {/* Delete confirmation */}
      {deleteConv && (
        <DeleteDialog
          title={deleteConv.title}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConv(null)}
        />
      )}

      {/* Share toast */}
      {showShareToast && <ShareToast onClose={() => setShowShareToast(false)} />}
    </>
  );
}
