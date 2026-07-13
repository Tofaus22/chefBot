import { createClient } from "./supabase";
import type { RecipeProfile } from "@/types";

interface AuthCache {
  userId: string | null;
  expires: number;
}

const TTL_MS = 30_000;
let authCache: AuthCache | null = null;

export async function getUserId(): Promise<string | null> {
  const now = Date.now();
  if (authCache && authCache.expires > now) return authCache.userId;
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id ?? null;
  authCache = { userId, expires: now + TTL_MS };
  return userId;
}

export function invalidateAuthCache() {
  authCache = null;
}

interface ProfileCache {
  userId: string;
  profile: RecipeProfile | null;
  expires: number;
}
const profileCache = new Map<string, ProfileCache>();

export async function getCachedProfile(userId: string): Promise<RecipeProfile | null> {
  const now = Date.now();
  const cached = profileCache.get(userId);
  if (cached && cached.expires > now) return cached.profile;

  const supabase = createClient();
  const { data } = await supabase
    .from("culinary_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  profileCache.set(userId, {
    userId,
    profile: (data as RecipeProfile | null) ?? null,
    expires: now + TTL_MS,
  });
  return (data as RecipeProfile | null) ?? null;
}

export function invalidateProfileCache(userId?: string) {
  if (userId) profileCache.delete(userId);
  else profileCache.clear();
}
