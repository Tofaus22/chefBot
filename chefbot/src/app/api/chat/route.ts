import { NextRequest, NextResponse } from "next/server";
import { groqClient, GROQ_MODEL } from "@/lib/groq";
import { buildSystemPrompt } from "@/lib/prompts";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { ChatMessage, RecipeProfile } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const profileCache = new Map<string, { profile: RecipeProfile | null; expires: number }>();
const PROFILE_TTL_MS = 60_000;

function getRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

async function loadProfile(userId: string, supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const now = Date.now();
  const cached = profileCache.get(userId);
  if (cached && cached.expires > now) return cached.profile;

  const { data } = await supabase
    .from("culinary_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const profile = (data as RecipeProfile | null) ?? null;
  profileCache.set(userId, { profile, expires: now + PROFILE_TTL_MS });
  return profile;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    if (!getRateLimit(user.id)) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Espera un momento antes de continuar." },
        { status: 429 }
      );
    }

    const { messages } = (await request.json()) as { messages: ChatMessage[] };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    const [profile] = await Promise.all([loadProfile(user.id, supabase)]);
    const systemPrompt = buildSystemPrompt(profile);

    const groqMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
        content: m.parts.map((p) => p.text).join(""),
      })),
    ];

    const stream = await groqClient.chat.completions.create({
      model: GROQ_MODEL,
      messages: groqMessages,
      stream: true,
      temperature: 0.7,
      max_tokens: 2048,
    });

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices?.[0]?.delta?.content ?? "";
            if (text) controller.enqueue(encoder.encode(text));
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Groq API error:", errMsg);
    return NextResponse.json(
      { error: "Error al conectar con ChefBot. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
