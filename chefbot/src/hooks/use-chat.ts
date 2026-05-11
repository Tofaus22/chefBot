"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import type { Message, ChatMessage } from "@/types";

interface UseChatOptions {
  conversationId: string | null;
  onConversationCreated?: (id: string) => void;
}

export function useChat({ conversationId, onConversationCreated }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const loadMessages = useCallback(async (convId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });

    if (error) {
      setError("Error al cargar mensajes");
      return;
    }
    setMessages(data || []);
  }, [supabase]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      setError(null);
      setIsLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("No autenticado");
        setIsLoading(false);
        return;
      }

      // Create conversation if needed
      let convId = conversationId;
      if (!convId) {
        const title = content.slice(0, 50) + (content.length > 50 ? "..." : "");
        const { data: conv, error: convErr } = await supabase
          .from("conversations")
          .insert({ user_id: user.id, title })
          .select()
          .single();

        if (convErr || !conv) {
          setError("Error al crear conversación");
          setIsLoading(false);
          return;
        }
        convId = conv.id;
        onConversationCreated?.(convId!);
      }

      // At this point convId is guaranteed to be a string
      const finalConvId = convId as string;

      // Add user message optimistically
      const userMessage: Message = {
        id: crypto.randomUUID(),
        conversation_id: finalConvId,
        role: "user",
        content,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // Save user message to DB
      await supabase.from("messages").insert({
        conversation_id: finalConvId,
        role: "user",
        content,
      });

      // Build Gemini history
      const currentMessages = [...messages, userMessage];
      const chatHistory: ChatMessage[] = currentMessages.map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      }));

      // Add assistant placeholder
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        conversation_id: finalConvId,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: chatHistory }),
        });

        if (!response.ok) throw new Error("API error");

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullContent = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            fullContent += chunk;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessage.id ? { ...m, content: fullContent } : m
              )
            );
          }
        }

        // Save assistant message to DB
        await supabase.from("messages").insert({
          conversation_id: finalConvId,
          role: "assistant",
          content: fullContent,
        });
      } catch {
        setError("Error al conectar con ChefBot. Intenta de nuevo.");
        setMessages((prev) => prev.filter((m) => m.id !== assistantMessage.id));
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId, isLoading, messages, onConversationCreated, supabase]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isLoading, error, sendMessage, loadMessages, clearMessages };
}
