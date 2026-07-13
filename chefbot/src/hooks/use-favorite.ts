"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { getUserId } from "@/lib/cache";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(id: string | undefined | null): boolean {
  return !!id && UUID_RE.test(id);
}

export function useFavorite(messageId: string | undefined, isUser: boolean) {
  const [favorited, setFavorited] = useState(false);
  const [loading, setLoading] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    if (isUser || !isUuid(messageId)) return;

    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("favorites")
        .select("id")
        .eq("message_id", messageId as string)
        .maybeSingle();
      if (!cancelled) setFavorited(!!data);
    })();
    return () => {
      cancelled = true;
    };
  }, [messageId, isUser]);

  const toggle = useCallback(async () => {
    if (loading || isUser || !isUuid(messageId)) return;
    setLoading(true);
    const userId = await getUserId();
    if (!userId) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    if (favorited) {
      await supabase
        .from("favorites")
        .delete()
        .eq("message_id", messageId as string)
        .eq("user_id", userId);
      setFavorited(false);
    } else {
      await supabase
        .from("favorites")
        .insert({ message_id: messageId as string, user_id: userId });
      setFavorited(true);
    }
    setLoading(false);
  }, [favorited, isUser, loading, messageId]);

  return { favorited, loading, toggle };
}
