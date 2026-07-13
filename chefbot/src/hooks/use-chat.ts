"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { getUserId } from "@/lib/cache";
import type { Message, ChatMessage } from "@/types";

const SUGGESTION_RE = /<!--\s*SUGERENCIAS:\s*(\[[\s\S]*?\])\s*-->/;
const STRIP_RE = /<!--\s*SUGERENCIAS:[\s\S]*?-->/g;

export interface UseChatOptions {
  conversationId: string | null;
  onConversationCreated?: (id: string) => void;
}

export function useChat({ conversationId, onConversationCreated }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const loadMessages = useCallback(async (convId: string) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("messages")
      .select("id, conversation_id, role, content, created_at")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    if (error) {
      setError("Error al cargar mensajes");
      return;
    }
    const list = (data ?? []) as Message[];
    messagesRef.current = list;
    setMessages(list);
  }, []);

  const ensureConversation = useCallback(
    async (userId: string, title: string): Promise<string | null> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("conversations")
        .insert({ user_id: userId, title })
        .select("id")
        .single();
      if (error || !data) return null;
      onConversationCreated?.(data.id);
      return data.id;
    },
    [onConversationCreated]
  );

  const persistMessage = useCallback(
    async (convId: string, role: "user" | "assistant", content: string) => {
      const supabase = createClient();
      try {
        await supabase.from("messages").insert({
          conversation_id: convId,
          role,
          content,
        });
      } catch {
        // fire-and-forget; UI already optimistically updated
      }
    },
    []
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text || isLoading) return;

      const userId = await getUserId();
      if (!userId) {
        setError("No autenticado");
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setError(null);
      setIsLoading(true);

      let convId = conversationId;
      if (!convId) {
        const title = text.slice(0, 50) + (text.length > 50 ? "..." : "");
        const newId = await ensureConversation(userId, title);
        if (!newId) {
          setError("Error al crear conversación");
          setIsLoading(false);
          return;
        }
        convId = newId;
      }

      const userMessage: Message = {
        id: crypto.randomUUID(),
        conversation_id: convId,
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
      };

      const assistantId = crypto.randomUUID();
      const assistantMessage: Message = {
        id: assistantId,
        conversation_id: convId,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
      };

      const baseHistory = messagesRef.current;
      const next: Message[] = [...baseHistory, userMessage, assistantMessage];
      messagesRef.current = next;
      setMessages(next);

      const chatHistory: ChatMessage[] = [...baseHistory, userMessage].map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      }));

      void persistMessage(convId, "user", text);

      let fullContent = "";
      let rafScheduled = false;
      let pendingContent = false;

      const flushContent = () => {
        if (!pendingContent) return;
        pendingContent = false;
        const snapshot = fullContent;
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          if (last.id !== assistantId || last.content === snapshot) return prev;
          const updated = prev.slice();
          updated[updated.length - 1] = { ...last, content: snapshot };
          messagesRef.current = updated;
          return updated;
        });
      };

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: chatHistory }),
          signal: controller.signal,
        });
        if (!response.ok || !response.body) throw new Error("API error");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) continue;
          fullContent += chunk;
          pendingContent = true;
          if (!rafScheduled) {
            rafScheduled = true;
            requestAnimationFrame(() => {
              rafScheduled = false;
              flushContent();
            });
          }
        }

        flushContent();
        const final = messagesRef.current.filter((m) => m.id !== assistantId);
        const finalAssistant: Message = {
          ...assistantMessage,
          content: fullContent,
        };
        const updated = [...final, finalAssistant];
        messagesRef.current = updated;
        setMessages(updated);
        void persistMessage(convId, "assistant", fullContent);
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        setError("Error al conectar con ChefBot. Intenta de nuevo.");
        const filtered = messagesRef.current.filter((m) => m.id !== assistantId);
        messagesRef.current = filtered;
        setMessages(filtered);
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId, ensureConversation, isLoading, persistMessage]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  }, []);

  const clearMessages = useCallback(() => {
    messagesRef.current = [];
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isLoading, error, sendMessage, loadMessages, clearMessages, stop };
}

export const __test__ = { SUGGESTION_RE, STRIP_RE };
