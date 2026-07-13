-- ============================================
-- MIGRATIONS (ejecutar si las tablas ya existen)
-- ============================================
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false NOT NULL;

-- ============================================
-- MIGRATION: Perfil culinario del usuario
-- ============================================
CREATE TABLE IF NOT EXISTS public.culinary_profiles (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  alergias              TEXT[] DEFAULT '{}',
  dieta                 TEXT DEFAULT NULL,
  nivel                 TEXT DEFAULT NULL,
  presupuesto           TEXT DEFAULT NULL,
  tiempo_disponible     TEXT DEFAULT NULL,
  ingredientes_frecuentes TEXT[] DEFAULT '{}',
  porciones_habituales  INTEGER DEFAULT 2,
  onboarding_done       BOOLEAN DEFAULT false NOT NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_culinary_profiles_user_id ON public.culinary_profiles(user_id);

ALTER TABLE public.culinary_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.culinary_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.culinary_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.culinary_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- MIGRATION: Compartir conversaciones
-- ============================================
CREATE TABLE IF NOT EXISTS public.shared_conversations (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE,
  expires_at      TIMESTAMPTZ DEFAULT NULL,
  revoked         BOOLEAN DEFAULT false NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shared_conversations_token ON public.shared_conversations(token);
CREATE INDEX IF NOT EXISTS idx_shared_conversations_conversation_id ON public.shared_conversations(conversation_id);

ALTER TABLE public.shared_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their shares"
  ON public.shared_conversations FOR ALL
  USING (auth.uid() = owner_id);

CREATE POLICY "Anyone can read active shares"
  ON public.shared_conversations FOR SELECT
  USING (revoked = false AND (expires_at IS NULL OR expires_at > NOW()));

-- ============================================
-- MIGRATION: Feedback de recetas
-- ============================================
CREATE TABLE IF NOT EXISTS public.recipe_feedback (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id  UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  useful      BOOLEAN DEFAULT NULL,
  cooked      BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (user_id, message_id)
);

ALTER TABLE public.recipe_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own feedback"
  ON public.recipe_feedback FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- ChefBot - SQL Setup para Supabase
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================

-- 1. Tabla: conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'Nueva conversación',
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Tabla: messages
CREATE TABLE IF NOT EXISTS public.messages (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id   UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role              TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content           TEXT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- Índices para mejorar rendimiento
-- ============================================
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Habilitar RLS en ambas tablas
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Políticas para conversations
CREATE POLICY "Users can view their own conversations"
  ON public.conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
  ON public.conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations"
  ON public.conversations FOR DELETE
  USING (auth.uid() = user_id);

-- 3. Tabla: favorites
CREATE TABLE IF NOT EXISTS public.favorites (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id  UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_message_id ON public.favorites(message_id);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own favorites"
  ON public.favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorites"
  ON public.favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites"
  ON public.favorites FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas para messages (acceso via conversations)
CREATE POLICY "Users can view messages of their conversations"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = messages.conversation_id
        AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in their conversations"
  ON public.messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = messages.conversation_id
        AND conversations.user_id = auth.uid()
    )
  );

-- Policy to allow reading messages of publicly shared (active) conversations
CREATE POLICY "Anyone can read messages of active shared conversations"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shared_conversations sc
      WHERE sc.conversation_id = messages.conversation_id
        AND sc.revoked = false
        AND (sc.expires_at IS NULL OR sc.expires_at > NOW())
    )
  );

-- Allow reading conversation info for active shared conversations
CREATE POLICY "Anyone can read active shared conversation info"
  ON public.conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shared_conversations sc
      WHERE sc.conversation_id = conversations.id
        AND sc.revoked = false
        AND (sc.expires_at IS NULL OR sc.expires_at > NOW())
    )
  );
