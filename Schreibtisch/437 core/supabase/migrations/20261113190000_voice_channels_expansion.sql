-- Voice Channels: Call History, Categories, Moderation
-- 437 Core - Idempotent. Execute in Supabase SQL Editor.

-- 1. voice_call_history — dauerhafte Speicherung von Voice-Session-Teilnahmen
CREATE TABLE IF NOT EXISTS public.voice_call_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.voice_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  duration_sec INTEGER,
  had_audio BOOLEAN NOT NULL DEFAULT true,
  had_video BOOLEAN NOT NULL DEFAULT false,
  had_screen BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS voice_call_history_channel_idx ON public.voice_call_history(channel_id, joined_at DESC);
CREATE INDEX IF NOT EXISTS voice_call_history_user_idx ON public.voice_call_history(user_id, joined_at DESC);
ALTER TABLE public.voice_call_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Voice call history sichtbar" ON public.voice_call_history;
CREATE POLICY "Voice call history sichtbar" ON public.voice_call_history FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Voice call history erstellen" ON public.voice_call_history;
CREATE POLICY "Voice call history erstellen" ON public.voice_call_history FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Voice call history aktualisieren" ON public.voice_call_history;
CREATE POLICY "Voice call history aktualisieren" ON public.voice_call_history FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'voice_call_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_call_history;
  END IF;
END $$;

-- 2. voice_channel_categories — Kategorien zur Channel-Organisation
CREATE TABLE IF NOT EXISTS public.voice_channel_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '📁',
  color TEXT DEFAULT 'var(--neon-cyan)',
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sort_order INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.voice_channel_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Voice channel categories sichtbar" ON public.voice_channel_categories;
CREATE POLICY "Voice channel categories sichtbar" ON public.voice_channel_categories FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Voice channel categories erstellen" ON public.voice_channel_categories;
CREATE POLICY "Voice channel categories erstellen" ON public.voice_channel_categories FOR INSERT TO anon, authenticated WITH CHECK (true);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'voice_channel_categories'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_channel_categories;
  END IF;
END $$;

-- 3. category_id zu voice_channels
ALTER TABLE public.voice_channels ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.voice_channel_categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS voice_channels_category_idx ON public.voice_channels(category_id);

-- 4. Moderations-Spalten zu voice_participants
ALTER TABLE public.voice_participants ADD COLUMN IF NOT EXISTS muted_until TIMESTAMPTZ;
ALTER TABLE public.voice_participants ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;
ALTER TABLE public.voice_participants ADD COLUMN IF NOT EXISTS banned_by UUID REFERENCES public.profiles(id);
CREATE INDEX IF NOT EXISTS voice_participants_muted_idx ON public.voice_participants(muted_until);
CREATE INDEX IF NOT EXISTS voice_participants_banned_idx ON public.voice_participants(banned_at);
