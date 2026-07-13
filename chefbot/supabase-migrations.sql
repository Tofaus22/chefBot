-- ============================================
-- ChefBot - MIGRACIONES NUEVAS
-- Ejecutar SOLO esto en Supabase Dashboard > SQL Editor
-- (Las tablas base ya existen, esto solo agrega lo nuevo)
-- ============================================

-- 1. Columna pinned (si no existe)
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false NOT NULL;

-- ============================================
-- 2. Perfil culinario del usuario
-- ============================================
CREATE TABLE IF NOT EXISTS public.culinary_profiles (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  alergias                TEXT[] DEFAULT '{}',
  dieta                   TEXT DEFAULT NULL,
  nivel                   TEXT DEFAULT NULL,
  presupuesto             TEXT DEFAULT NULL,
  tiempo_disponible       TEXT DEFAULT NULL,
  ingredientes_frecuentes TEXT[] DEFAULT '{}',
  porciones_habituales    INTEGER DEFAULT 2,
  onboarding_done         BOOLEAN DEFAULT false NOT NULL,
  created_at              TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_culinary_profiles_user_id ON public.culinary_profiles(user_id);

ALTER TABLE public.culinary_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view their own profile"
    ON public.culinary_profiles FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert their own profile"
    ON public.culinary_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own profile"
    ON public.culinary_profiles FOR UPDATE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- 3. Compartir conversaciones
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

DO $$ BEGIN
  CREATE POLICY "Owners can manage their shares"
    ON public.shared_conversations FOR ALL
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Anyone can read active shares"
    ON public.shared_conversations FOR SELECT
    USING (revoked = false AND (expires_at IS NULL OR expires_at > NOW()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Permitir leer mensajes de conversaciones compartidas activas
DO $$ BEGIN
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
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Permitir leer datos de conversación cuando está compartida
DO $$ BEGIN
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
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- 4. Feedback de recetas
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

DO $$ BEGIN
  CREATE POLICY "Users can manage their own feedback"
    ON public.recipe_feedback FOR ALL
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
