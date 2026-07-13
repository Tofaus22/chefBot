"use client";

import { useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { getUserId, getCachedProfile, invalidateProfileCache } from "@/lib/cache";

export interface CulinaryProfileData {
  alergias: string[];
  dieta: string | null;
  nivel: string | null;
  presupuesto: string | null;
  tiempo_disponible: string | null;
  ingredientes_frecuentes: string[];
  porciones_habituales: number;
  onboarding_done: boolean;
}

const DEFAULT: CulinaryProfileData = {
  alergias: [],
  dieta: null,
  nivel: null,
  presupuesto: null,
  tiempo_disponible: null,
  ingredientes_frecuentes: [],
  porciones_habituales: 2,
  onboarding_done: false,
};

export function useCulinaryProfile(isOpen: boolean) {
  const [profile, setProfile] = useState<CulinaryProfileData>(DEFAULT);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    const userId = await getUserId();
    if (!userId) {
      setLoading(false);
      return;
    }
    const data = await getCachedProfile(userId);
    if (data) {
      setProfile({
        alergias: data.alergias ?? [],
        dieta: data.dieta ?? null,
        nivel: data.nivel ?? null,
        presupuesto: data.presupuesto ?? null,
        tiempo_disponible: data.tiempo_disponible ?? null,
        ingredientes_frecuentes: data.ingredientes_frecuentes ?? [],
        porciones_habituales: data.porciones_habituales ?? 2,
        onboarding_done: data.onboarding_done ?? false,
      });
    } else {
      setProfile(DEFAULT);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isOpen) void loadProfile();
  }, [isOpen, loadProfile]);

  const saveProfile = useCallback(
    async (next: CulinaryProfileData) => {
      const userId = await getUserId();
      if (!userId) return false;
      const supabase = createClient();
      const payload = {
        user_id: userId,
        ...next,
        onboarding_done: true,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("culinary_profiles")
        .upsert(payload, { onConflict: "user_id" });
      if (!error) invalidateProfileCache(userId);
      return !error;
    },
    []
  );

  return { profile, setProfile, loading, saveProfile };
}
