"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useChat } from "@/hooks/use-chat";
import { useTheme } from "@/hooks/use-theme";
import { getUserId, getCachedProfile, invalidateProfileCache } from "@/lib/cache";
import { Sidebar } from "@/components/sidebar";
import { ChatWindow } from "@/components/chat-window";
import { InputBar } from "@/components/input-bar";
import { CulinaryProfile } from "@/components/culinary-profile";
import { Button } from "@/components/ui/button";
import { UserCircle2, RefreshCw } from "lucide-react";

export default function ChatPage() {
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const { isDark, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const userId = await getUserId();
      if (!userId || cancelled) return;
      const profile = await getCachedProfile(userId);
      if (!cancelled && (!profile || !profile.onboarding_done)) {
        setShowOnboarding(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleConversationCreated = useCallback((id: string) => {
    setCurrentConversationId(id);
  }, []);

  const {
    messages,
    isLoading,
    error,
    editingUserId,
    sendMessage,
    loadMessages,
    clearMessages,
    stop,
    regenerate,
    retry,
    startEdit,
    cancelEdit,
    submitEdit,
  } = useChat({
    conversationId: currentConversationId,
    onConversationCreated: handleConversationCreated,
  });

  const handleSelectConversation = useCallback(
    async (id: string) => {
      setCurrentConversationId(id);
      clearMessages();
      await loadMessages(id);
    },
    [clearMessages, loadMessages]
  );

  const handleNewConversation = useCallback(() => {
    setCurrentConversationId(null);
    clearMessages();
  }, [clearMessages]);

  const handleSuggest = useCallback((text: string) => sendMessage(text), [sendMessage]);

  const handleOnboardingComplete = useCallback(() => {
    invalidateProfileCache();
    setShowOnboarding(false);
  }, []);

  const editingText = useMemo(() => {
    if (!editingUserId) return null;
    const m = messages.find((msg) => msg.id === editingUserId);
    return m?.content ?? null;
  }, [editingUserId, messages]);

  const handleSubmitEdit = useCallback(
    (text: string) => {
      if (editingUserId) void submitEdit(editingUserId, text);
    },
    [editingUserId, submitEdit]
  );

  const handleRetry = useCallback(() => {
    void retry();
  }, [retry]);

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
        <div className="border-b border-border px-6 py-3 flex items-center justify-between pl-16 md:pl-6">
          <div>
            <h2 className="font-semibold text-foreground">
              {currentConversationId ? "Conversación activa" : "Nueva conversación"}
            </h2>
            <p className="text-xs text-muted-foreground">ChefBot • Powered by Llama 3.1 (Groq)</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowProfile(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-amber-500 transition-colors"
              title="Tu perfil culinario"
            >
              <UserCircle2 className="h-4 w-4" />
              <span className="hidden sm:inline">Mi perfil</span>
            </button>
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-xs text-muted-foreground">En línea</span>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm px-6 py-2 border-b border-destructive/20 flex items-center gap-3">
            <span className="flex-1">{error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              className="h-7 px-2 text-xs gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <RefreshCw className="h-3 w-3" />
              Reintentar
            </Button>
          </div>
        )}

        <ChatWindow
          messages={messages}
          isLoading={isLoading}
          editingUserId={editingUserId}
          onSuggest={handleSuggest}
          onRegenerate={regenerate}
          onStartEdit={startEdit}
        />

        <InputBar
          onSend={sendMessage}
          onStop={stop}
          isLoading={isLoading}
          editingText={editingText}
          onCancelEdit={cancelEdit}
          onSubmitEdit={handleSubmitEdit}
        />
      </main>

      <CulinaryProfile
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        isOnboarding={true}
        onOnboardingComplete={handleOnboardingComplete}
      />

      <CulinaryProfile
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
      />
    </div>
  );
}
