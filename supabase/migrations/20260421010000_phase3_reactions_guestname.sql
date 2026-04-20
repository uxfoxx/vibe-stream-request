-- Phase 3 migrations: track_reactions, message_reactions, guest_name on messages

-- 1. Add guest_name column to messages (for unauthenticated guest chat)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS guest_name TEXT;

-- 2. Allow unauthenticated users to insert chat messages (guest mode)
DROP POLICY IF EXISTS "Guests can send chat messages" ON public.messages;
CREATE POLICY "Guests can send chat messages" ON public.messages
  FOR INSERT TO anon
  WITH CHECK (
    user_id IS NULL
    AND guest_name IS NOT NULL
    AND type = 'chat'
  );

-- 3. Create track_reactions table
CREATE TABLE IF NOT EXISTS public.track_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID NOT NULL REFERENCES public.queue(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (queue_id, user_id, emoji)
);

ALTER TABLE public.track_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read track reactions" ON public.track_reactions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can react to tracks" ON public.track_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their own track reactions" ON public.track_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. Create message_reactions table
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read message reactions" ON public.message_reactions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can react to messages" ON public.message_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their own message reactions" ON public.message_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);
