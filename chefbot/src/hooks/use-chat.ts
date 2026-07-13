"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { getUserId } from "@/lib/cache";
import { parseStream } from "@/lib/structured-recipe";
import type { Message, ChatMessage } from "@/types";

const RETRY_DELAY_MS = 800;
const STREAM_RETRY_MAX = 1;

export interface UseChatOptions {
  conversationId: string | null;
  onConversationCreated?: (id: string) => void;
}

export class StreamError extends Error {}

function lastIndexByRole(msgs: Message[], role: "user" | "assistant"): number {
  for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === role) return i;
  return -1;
}

export function useChat({ conversationId, onConversationCreated }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const loadMessages = useCallback(async (convId: string) => {
    const supabase = createClient();
    const { data, error: loadErr } = await supabase
      .from("messages")
      .select("id, conversation_id, role, content, created_at")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    if (loadErr) {
      setError("Error al cargar mensajes");
      return;
    }
    const list = (data ?? []) as Message[];
    messagesRef.current = list;
    setMessages(list);
    setEditingUserId(null);
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
    async (convId: string, role: "user" | "assistant", content: string, id: string) => {
      const supabase = createClient();
      try {
        await supabase.from("messages").insert({
          id,
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

  const deleteMessageById = useCallback(async (id: string) => {
    const supabase = createClient();
    try {
      await supabase.from("messages").delete().eq("id", id);
    } catch {
      // best effort
    }
  }, []);

  const updateMessageContent = useCallback(async (id: string, content: string) => {
    const supabase = createClient();
    try {
      await supabase
        .from("messages")
        .update({ content })
        .eq("id", id);
    } catch {
      // best effort
    }
  }, []);

  const streamAssistant = useCallback(
    async (convId: string, history: Message[], opts: { skipUserPersist?: boolean } = {}) => {
      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;

      const assistantId = crypto.randomUUID();
      const assistantMessage: Message = {
        id: assistantId,
        conversation_id: convId,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
      };

      const withPlaceholder: Message[] = [...history, assistantMessage];
      messagesRef.current = withPlaceholder;
      setMessages(withPlaceholder);

      const chatHistory: ChatMessage[] = history
        .filter((m) => m.content.trim().length > 0)
        .map((m) => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.content }],
        }));

      let fullContent = "";
      let rafScheduled = false;
      let pendingContent = false;
      let aborted = false;

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
        let attempt = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          try {
            const response = await fetch("/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ messages: chatHistory }),
              signal: controller.signal,
            });
            if (!response.ok || !response.body) {
              const detail = await response.text().catch(() => "");
              throw new Error(`API ${response.status}: ${detail.slice(0, 120)}`);
            }

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
            break;
          } catch (err) {
            if (controller.signal.aborted) {
              aborted = true;
              break;
            }
            attempt += 1;
            if (attempt > STREAM_RETRY_MAX) throw err;
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
          }
        }

        flushContent();

        if (aborted) return;

        if (fullContent.length === 0) {
          // placeholder didn't stream anything; surface error to caller
          throw new StreamError("empty");
        }

        const parsed = parseStream(fullContent);
        const storedContent = parsed.envelope ? parsed.envelope.answer : fullContent;
        const finalAssistant: Message = {
          ...assistantMessage,
          content: storedContent,
          structured: parsed.envelope,
        };
        const updated = messagesRef.current
          .filter((m) => m.id !== assistantId)
          .concat(finalAssistant);
        messagesRef.current = updated;
        setMessages(updated);

        await persistMessage(convId, "assistant", storedContent, assistantId);
        if (opts.skipUserPersist === false) {
          // (no-op; reserved for future)
        }
      } catch (err) {
        // clean the empty placeholder
        const trimmed = messagesRef.current.filter((m) => m.id !== assistantId);
        messagesRef.current = trimmed;
        setMessages(trimmed);
        if ((err as { name?: string })?.name === "AbortError") return;
        throw err;
      }
    },
    [persistMessage]
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

      setEditingUserId(null);
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

      const baseHistory = [...messagesRef.current, userMessage];
      messagesRef.current = baseHistory;
      setMessages(baseHistory);

      await persistMessage(convId, "user", text, userMessage.id);

      try {
        await streamAssistant(convId, baseHistory);
      } catch {
        setError("Error al conectar con ChefBot. Intenta de nuevo.");
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId, ensureConversation, isLoading, persistMessage, streamAssistant]
  );

  const regenerate = useCallback(async () => {
    if (isLoading) return;
    const history = messagesRef.current;
    const userIdx = lastIndexByRole(history, "user");
    const assistantIdx = lastIndexByRole(history, "assistant");
    if (userIdx < 0 || assistantIdx < 0) return;
    if (assistantIdx <= userIdx) return;

    const convId = history[userIdx].conversation_id;
    const previousAssistant = history[assistantIdx];
    const trimmed = history.slice(0, userIdx + 1);

    messagesRef.current = trimmed;
    setMessages(trimmed);
    await deleteMessageById(previousAssistant.id);

    setError(null);
    setIsLoading(true);
    try {
      await streamAssistant(convId, trimmed);
    } catch {
      setError("Error al regenerar la respuesta. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  }, [deleteMessageById, isLoading, streamAssistant]);

  const startEdit = useCallback((userMessageId: string) => {
    setError(null);
    setEditingUserId(userMessageId);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingUserId(null);
  }, []);

  const submitEdit = useCallback(
    async (userMessageId: string, newContent: string) => {
      const text = newContent.trim();
      if (!text || isLoading) return;
      const history = messagesRef.current;
      const userIdx = history.findIndex((m) => m.id === userMessageId);
      if (userIdx < 0 || history[userIdx].role !== "user") return;

      const assistantIdx = lastIndexByRole(history, "assistant");
      const previousAssistant = assistantIdx > userIdx ? history[assistantIdx] : null;

      const userRow: Message = { ...history[userIdx], content: text };
      const trimmed: Message[] = [
        ...history.slice(0, userIdx),
        userRow,
        ...history.slice(userIdx + 1).filter((m) => m.role !== "assistant"),
      ];
      messagesRef.current = trimmed;
      setMessages(trimmed);
      setEditingUserId(null);

      await updateMessageContent(userMessageId, text);
      if (previousAssistant && previousAssistant.id !== userMessageId) {
        await deleteMessageById(previousAssistant.id);
      }

      const convId = userRow.conversation_id;
      setError(null);
      setIsLoading(true);
      try {
        await streamAssistant(convId, trimmed);
      } catch {
        setError("Error al enviar el mensaje editado. Intenta de nuevo.");
      } finally {
        setIsLoading(false);
      }
    },
    [deleteMessageById, isLoading, streamAssistant, updateMessageContent]
  );

  const retry = useCallback(async () => {
    if (isLoading) return;
    const history = messagesRef.current;
    const userIdx = lastIndexByRole(history, "user");
    if (userIdx < 0) return;
    const convId = history[userIdx].conversation_id;

    const assistantIdx = lastIndexByRole(history, "assistant");
    if (assistantIdx > userIdx) {
      const previousAssistant = history[assistantIdx];
      const trimmed = history.slice(0, userIdx + 1);
      messagesRef.current = trimmed;
      setMessages(trimmed);
      await deleteMessageById(previousAssistant.id);
    }

    setError(null);
    setIsLoading(true);
    try {
      await streamAssistant(convId, messagesRef.current);
    } catch {
      setError("Error al conectar con ChefBot. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  }, [deleteMessageById, isLoading, streamAssistant]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  }, []);

  const clearMessages = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    messagesRef.current = [];
    setMessages([]);
    setError(null);
    setEditingUserId(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    editingUserId,
    sendMessage,
    regenerate,
    retry,
    startEdit,
    cancelEdit,
    submitEdit,
    loadMessages,
    clearMessages,
    stop,
  };
}

export const __test__ = {};
