"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase";
import { getUserId } from "@/lib/cache";

interface ShareResult {
  url: string;
  token: string;
  alreadyShared: boolean;
}

interface UseShareConversationOptions {
  onShared?: (conversationId: string) => void;
  onRevoked?: (conversationId: string) => void;
}

export function useShareConversation(opts: UseShareConversationOptions = {}) {
  const [showToast, setShowToast] = useState(false);

  const share = useCallback(
    async (conversationId: string): Promise<ShareResult | null> => {
      const userId = await getUserId();
      if (!userId) return null;

      const supabase = createClient();
      const { data: existing } = await supabase
        .from("shared_conversations")
        .select("token")
        .eq("conversation_id", conversationId)
        .eq("owner_id", userId)
        .eq("revoked", false)
        .maybeSingle();

      let token: string;
      let alreadyShared = false;
      if (existing?.token) {
        token = existing.token;
        alreadyShared = true;
      } else {
        token = Array.from(crypto.getRandomValues(new Uint8Array(18)))
          .map((b) => b.toString(36).padStart(2, "0"))
          .join("")
          .slice(0, 24);

        const { error } = await supabase
          .from("shared_conversations")
          .insert({
            conversation_id: conversationId,
            owner_id: userId,
            token,
          });

        if (error) {
          console.error("Share insert error:", error.message);
          return null;
        }
        opts.onShared?.(conversationId);
      }

      const url = `${window.location.origin}/share/${token}`;
      try {
        await navigator.clipboard.writeText(url);
        setShowToast(true);
      } catch {
        prompt("Copia este enlace:", url);
      }

      return { url, token, alreadyShared };
    },
    [opts]
  );

  const revoke = useCallback(
    async (conversationId: string): Promise<boolean> => {
      const userId = await getUserId();
      if (!userId) return false;
      const supabase = createClient();
      const { error } = await supabase
        .from("shared_conversations")
        .update({ revoked: true })
        .eq("conversation_id", conversationId)
        .eq("owner_id", userId)
        .eq("revoked", false);

      if (error) {
        console.error("Revoke error:", error.message);
        return false;
      }
      opts.onRevoked?.(conversationId);
      return true;
    },
    [opts]
  );

  return { share, revoke, showToast, closeToast: () => setShowToast(false) };
}
