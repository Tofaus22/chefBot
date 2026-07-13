"use client";

import { useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Plus, LogOut, ChefHat, Search, Sun, Moon,
  X, Menu, Heart, BookOpen, Trash2,
} from "lucide-react";
import { useSidebarData } from "@/hooks/use-sidebar-data";
import { useShareConversation } from "@/hooks/use-share-conversation";
import { groupByDate } from "@/lib/group-conversations";
import { invalidateAuthCache } from "@/lib/cache";
import type { Conversation } from "@/types";
import { ContextMenu } from "./sidebar/context-menu";
import { DeleteDialog } from "./sidebar/delete-dialog";
import { ShareToast } from "./sidebar/share-toast";
import { ConversationItem } from "./sidebar/conversation-item";

interface SidebarProps {
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

const DIFFICULTIES = ["Fácil", "Media", "Difícil"];

export function Sidebar({
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  isDark,
  onToggleTheme,
}: SidebarProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"history" | "favorites">("history");
  const [difficultyFilter, setDifficultyFilter] = useState<string | null>(null);
  const [menuConv, setMenuConv] = useState<Conversation | null>(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteConv, setDeleteConv] = useState<Conversation | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<{ label: string; ids: string[] } | null>(null);

  const {
    conversations, favorites, userEmail,
    sharedConvIds, addShare, removeShare,
    removeConversation, updateConversation,
  } = useSidebarData(currentConversationId);
  const { share, revoke, showToast, closeToast } = useShareConversation({
    onShared: addShare,
    onRevoked: removeShare,
  });

  const handleLogout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    invalidateAuthCache();
    window.location.href = "/auth";
  }, []);

  const handleSelect = useCallback(
    (id: string) => {
      onSelectConversation(id);
      setOpen(false);
    },
    [onSelectConversation]
  );

  const handleMenuOpen = useCallback((conv: Conversation, e: React.MouseEvent) => {
    e.preventDefault();
    setMenuConv(conv);
    setMenuPos({ x: e.clientX, y: e.clientY });
  }, []);

  const startRename = useCallback((conv: Conversation) => {
    setRenamingId(conv.id);
    setRenameValue(conv.title);
  }, []);

  const commitRename = useCallback(async () => {
    if (!renamingId || !renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    const supabase = createClient();
    const next = renameValue.trim();
    await supabase
      .from("conversations")
      .update({ title: next })
      .eq("id", renamingId);
    updateConversation(renamingId, { title: next });
    setRenamingId(null);
  }, [renamingId, renameValue, updateConversation]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") void commitRename();
      if (e.key === "Escape") setRenamingId(null);
    },
    [commitRename]
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteConv) return;
    const supabase = createClient();
    await supabase.from("conversations").delete().eq("id", deleteConv.id);
    removeConversation(deleteConv.id);
    if (currentConversationId === deleteConv.id) onNewConversation();
    setDeleteConv(null);
  }, [deleteConv, currentConversationId, onNewConversation, removeConversation]);

  const confirmDeleteGroup = useCallback(async () => {
    if (!deleteGroup) return;
    const supabase = createClient();
    const ids = deleteGroup.ids;
    await supabase.from("conversations").delete().in("id", ids);
    ids.forEach((id) => removeConversation(id));
    if (currentConversationId && ids.includes(currentConversationId)) onNewConversation();
    setDeleteGroup(null);
  }, [deleteGroup, currentConversationId, onNewConversation, removeConversation]);

  const handleTogglePin = useCallback(async (conv: Conversation) => {
    const next = !conv.pinned;
    const supabase = createClient();
    await supabase.from("conversations").update({ pinned: next }).eq("id", conv.id);
    updateConversation(conv.id, { pinned: next });
  }, [updateConversation]);

  const handleShare = useCallback(
    async (conv: Conversation) => {
      const result = await share(conv.id);
      if (result?.alreadyShared) {
        // refresh shared ids in case the row was missed on initial load
        await addShare(conv.id);
      }
    },
    [share, addShare]
  );

  const handleRevoke = useCallback(
    async (conv: Conversation) => {
      await revoke(conv.id);
    },
    [revoke]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, search]);

  const filteredFavorites = useMemo(() => {
    let list = favorites;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((f) =>
        f.messages?.content?.toLowerCase().includes(q)
      );
    }
    if (difficultyFilter) {
      list = list.filter((f) =>
        f.messages?.content?.toLowerCase().includes(difficultyFilter.toLowerCase())
      );
    }
    return list;
  }, [favorites, search, difficultyFilter]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);

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
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleTheme}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground md:hidden"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Button onClick={onNewConversation} className="w-full gap-2 mb-3" variant="outline">
          <Plus className="h-4 w-4" /> Nueva conversación
        </Button>

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
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex gap-1 mt-2">
          <button
            onClick={() => { setTab("history"); setSearch(""); }}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md transition-colors",
              tab === "history" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-accent"
            )}
          >
            <BookOpen className="h-3 w-3" /> Historial
          </button>
          <button
            onClick={() => { setTab("favorites"); setSearch(""); }}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md transition-colors",
              tab === "favorites" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-accent"
            )}
          >
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
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {label}
                    </p>
                    {label !== "Anclados" && convs.length > 0 && (
                      <button
                        onClick={() => setDeleteGroup({ label, ids: convs.map((c) => c.id) })}
                        title={`Eliminar todas las conversaciones de ${label.toLowerCase()}`}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {convs.map((conv) => (
                    <ConversationItem
                      key={conv.id}
                      conv={conv}
                      isActive={currentConversationId === conv.id}
                      isShared={sharedConvIds.has(conv.id)}
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
              <div className="flex gap-1 px-1 pb-1 flex-wrap">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficultyFilter(difficultyFilter === d ? null : d)}
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                      difficultyFilter === d
                        ? "bg-amber-500 text-white border-amber-500"
                        : "border-border text-muted-foreground hover:border-amber-400"
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
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
                  <button
                    key={fav.id}
                    onClick={() =>
                      fav.messages?.conversation_id && handleSelect(fav.messages.conversation_id)
                    }
                    className="grid grid-cols-[auto_1fr] w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
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
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 h-9 w-9 bg-secondary border border-border shadow"
      >
        <Menu className="h-4 w-4" />
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 transition-transform duration-300 md:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </div>

      <div className="hidden md:flex">{sidebarContent}</div>

      {menuConv && (
        <ContextMenu
          conv={menuConv}
          position={menuPos}
          isShared={sharedConvIds.has(menuConv.id)}
          onClose={() => setMenuConv(null)}
          onRename={startRename}
          onDelete={setDeleteConv}
          onTogglePin={handleTogglePin}
          onShare={handleShare}
          onRevoke={handleRevoke}
        />
      )}

      {deleteConv && (
        <DeleteDialog
          title={deleteConv.title}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConv(null)}
        />
      )}

      {deleteGroup && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
          <div className="bg-popover border border-border rounded-xl shadow-2xl p-5 w-80 flex flex-col gap-4">
            <div>
              <h3 className="font-semibold text-foreground text-sm mb-1">Eliminar grupo</h3>
              <p className="text-xs text-muted-foreground">
                ¿Eliminar las <span className="font-medium text-foreground">{deleteGroup.ids.length}</span> conversaciones de <span className="font-medium text-foreground">&quot;{deleteGroup.label.toLowerCase()}&quot;</span>? Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setDeleteGroup(null)}>Cancelar</Button>
              <Button variant="destructive" size="sm" onClick={confirmDeleteGroup}>Eliminar todo</Button>
            </div>
          </div>
        </div>
      )}

      {showToast && <ShareToast onClose={closeToast} />}
    </>
  );
}
