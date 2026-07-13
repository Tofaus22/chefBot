"use client";

import { useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import type { Conversation } from "@/types";

interface FavoriteMessage {
  id: string;
  message_id: string;
  created_at: string;
  messages: { content: string; conversation_id: string } | null;
}

interface UseSidebarDataResult {
  conversations: Conversation[];
  favorites: FavoriteMessage[];
  userEmail: string | null;
  sharedConvIds: Set<string>;
  loading: boolean;
  reload: () => Promise<void>;
  reloadFavorites: () => Promise<void>;
  reloadShares: () => Promise<void>;
  removeConversation: (id: string) => void;
  removeShare: (conversationId: string) => void;
  addShare: (conversationId: string) => void;
  updateConversation: (id: string, patch: Partial<Conversation>) => void;
  addConversation: (conv: Conversation) => void;
}

export function useSidebarData(currentConversationId: string | null): UseSidebarDataResult {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [favorites, setFavorites] = useState<FavoriteMessage[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [sharedConvIds, setSharedConvIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadConversations = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("conversations")
      .select("id, user_id, title, created_at, pinned")
      .order("created_at", { ascending: false });
    setConversations((data ?? []) as Conversation[]);
  }, []);

  const loadFavorites = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("favorites")
      .select("id, message_id, created_at, messages(content, conversation_id)")
      .order("created_at", { ascending: false });
    setFavorites((data as unknown as FavoriteMessage[]) ?? []);
  }, []);

  const loadShares = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("shared_conversations")
      .select("conversation_id, revoked, expires_at");
    if (error) {
      console.warn("No se pudieron cargar los compartidos:", error.message);
      return;
    }
    const ids = new Set<string>();
    const now = Date.now();
    (data ?? []).forEach((s: { conversation_id: string; revoked: boolean; expires_at: string | null }) => {
      if (s.revoked) return;
      if (s.expires_at && new Date(s.expires_at).getTime() <= now) return;
      ids.add(s.conversation_id);
    });
    setSharedConvIds(ids);
  }, []);

  const loadUser = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    setUserEmail(data.user?.email ?? null);
  }, []);

  const reload = useCallback(async () => {
    await Promise.all([loadConversations(), loadFavorites(), loadUser(), loadShares()]);
    setLoading(false);
  }, [loadConversations, loadFavorites, loadUser, loadShares]);

  const reloadFavorites = useCallback(async () => {
    await loadFavorites();
  }, [loadFavorites]);

  const reloadShares = useCallback(async () => {
    await loadShares();
  }, [loadShares]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (currentConversationId) {
      void loadConversations();
      void loadFavorites();
    }
  }, [currentConversationId, loadConversations, loadFavorites]);

  const removeConversation = useCallback((id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const removeShare = useCallback((conversationId: string) => {
    setSharedConvIds((prev) => {
      const next = new Set(prev);
      next.delete(conversationId);
      return next;
    });
  }, []);

  const addShare = useCallback((conversationId: string) => {
    setSharedConvIds((prev) => {
      const next = new Set(prev);
      next.add(conversationId);
      return next;
    });
  }, []);

  const updateConversation = useCallback((id: string, patch: Partial<Conversation>) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
    );
  }, []);

  const addConversation = useCallback((conv: Conversation) => {
    setConversations((prev) => [conv, ...prev.filter((c) => c.id !== conv.id)]);
  }, []);

  return {
    conversations,
    favorites,
    userEmail,
    sharedConvIds,
    loading,
    reload,
    reloadFavorites,
    reloadShares,
    removeConversation,
    removeShare,
    addShare,
    updateConversation,
    addConversation,
  };
}
