"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase";
import { getUserId } from "@/lib/cache";

export function useShareConversation() {
  const [showToast, setShowToast] = useState(false);

  const share = useCallback(async (conversationId: string) => {
    const userId = await getUserId();
    if (!userId) return;

    const supabase = createClient();
    const { data: existing } = await supabase
      .from("shared_conversations")
      .select("token")
      .eq("conversation_id", conversationId)
      .eq("owner_id", userId)
      .eq("revoked", false)
      .maybeSingle();

    let token: string;
    if (existing?.token) {
      token = existing.token;
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
        return;
      }
    }

    const url = `${window.location.origin}/share/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setShowToast(true);
    } catch {
      prompt("Copia este enlace:", url);
    }
  }, []);

  return { share, showToast, closeToast: () => setShowToast(false) };
}
