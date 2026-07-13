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
  loading: boolean;
  reload: () => Promise<void>;
  reloadFavorites: () => Promise<void>;
  removeConversation: (id: string) => void;
  updateConversation: (id: string, patch: Partial<Conversation>) => void;
  addConversation: (conv: Conversation) => void;
}

export function useSidebarData(currentConversationId: string | null): UseSidebarDataResult {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [favorites, setFavorites] = useState<FavoriteMessage[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
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

  const loadUser = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    setUserEmail(data.user?.email ?? null);
  }, []);

  const reload = useCallback(async () => {
    await Promise.all([loadConversations(), loadFavorites(), loadUser()]);
    setLoading(false);
  }, [loadConversations, loadFavorites, loadUser]);

  const reloadFavorites = useCallback(async () => {
    await loadFavorites();
  }, [loadFavorites]);

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
    loading,
    reload,
    reloadFavorites,
    removeConversation,
    updateConversation,
    addConversation,
  };
}
