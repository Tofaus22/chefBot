"use client";

import { useState, useCallback, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { ChatWindow } from "@/components/chat-window";
import { InputBar } from "@/components/input-bar";
import { useChat } from "@/hooks/use-chat";

export default function ChatPage() {
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(true);

  // Sync theme from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("chefbot-theme");
    const dark = stored !== "light";
    setIsDark(dark);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem("chefbot-theme", next ? "dark" : "light");
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  }, []);

  const handleConversationCreated = useCallback((id: string) => {
    setCurrentConversationId(id);
  }, []);

  const { messages, isLoading, error, sendMessage, loadMessages, clearMessages } = useChat({
    conversationId: currentConversationId,
    onConversationCreated: handleConversationCreated,
  });

  const handleSelectConversation = useCallback(async (id: string) => {
    setCurrentConversationId(id);
    clearMessages();
    await loadMessages(id);
  }, [clearMessages, loadMessages]);

  const handleNewConversation = useCallback(() => {
    setCurrentConversationId(null);
    clearMessages();
  }, [clearMessages]);

  const handleSuggest = useCallback((text: string) => {
    sendMessage(text);
  }, [sendMessage]);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        currentConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />

      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="border-b border-border px-6 py-3 flex items-center justify-between pl-16 md:pl-6">
          <div>
            <h2 className="font-semibold text-foreground">
              {currentConversationId ? "Conversación activa" : "Nueva conversación"}
            </h2>
            <p className="text-xs text-muted-foreground">ChefBot • Powered by Llama 3.1 (Groq)</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-xs text-muted-foreground">En línea</span>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-destructive/10 text-destructive text-sm px-6 py-2 border-b border-destructive/20">
            {error}
          </div>
        )}

        {/* Chat area */}
        <ChatWindow messages={messages} isLoading={isLoading} onSuggest={handleSuggest} />

        {/* Input */}
        <InputBar onSend={sendMessage} isLoading={isLoading} />
      </main>
    </div>
  );
}
