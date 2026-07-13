"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { getUserId } from "@/lib/cache";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useFeedback(messageId: string | undefined, isUser: boolean) {
  const [feedback, setFeedback] = useState<boolean | null>(null);

  const vote = useCallback(
    async (useful: boolean) => {
      if (feedback !== null) return;
      if (isUser || !messageId || !UUID_RE.test(messageId)) return;
      const userId = await getUserId();
      if (!userId) return;
      const supabase = createClient();
      await supabase.from("recipe_feedback").upsert(
        { user_id: userId, message_id: messageId, useful },
        { onConflict: "user_id,message_id" }
      );
      setFeedback(useful);
    },
    [feedback, isUser, messageId]
  );

  return { feedback, vote };
}
