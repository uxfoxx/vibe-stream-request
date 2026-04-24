-- 1. Profile moderation fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS temp_ban_until timestamptz,
  ADD COLUMN IF NOT EXISTS ban_reason text;
-- avatar_url already exists per schema

-- 2. Skip votes
CREATE TABLE IF NOT EXISTS public.skip_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid NOT NULL REFERENCES public.queue(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (queue_id, user_id)
);
ALTER TABLE public.skip_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Skip votes viewable by everyone" ON public.skip_votes;
CREATE POLICY "Skip votes viewable by everyone" ON public.skip_votes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can vote skip" ON public.skip_votes;
CREATE POLICY "Authenticated users can vote skip" ON public.skip_votes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can remove own skip vote" ON public.skip_votes;
CREATE POLICY "Users can remove own skip vote" ON public.skip_votes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 3. Queue upvotes
CREATE TABLE IF NOT EXISTS public.queue_upvotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid NOT NULL REFERENCES public.queue(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (queue_id, user_id)
);
ALTER TABLE public.queue_upvotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Upvotes viewable by everyone" ON public.queue_upvotes;
CREATE POLICY "Upvotes viewable by everyone" ON public.queue_upvotes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can upvote" ON public.queue_upvotes;
CREATE POLICY "Authenticated users can upvote" ON public.queue_upvotes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can remove own upvote" ON public.queue_upvotes;
CREATE POLICY "Users can remove own upvote" ON public.queue_upvotes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 4. Track reactions
CREATE TABLE IF NOT EXISTS public.track_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid NOT NULL REFERENCES public.queue(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (queue_id, user_id, emoji)
);
ALTER TABLE public.track_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Track reactions viewable by everyone" ON public.track_reactions;
CREATE POLICY "Track reactions viewable by everyone" ON public.track_reactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can react to track" ON public.track_reactions;
CREATE POLICY "Authenticated users can react to track" ON public.track_reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can remove own track reaction" ON public.track_reactions;
CREATE POLICY "Users can remove own track reaction" ON public.track_reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 5. Message reactions
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Message reactions viewable by everyone" ON public.message_reactions;
CREATE POLICY "Message reactions viewable by everyone" ON public.message_reactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can react to message" ON public.message_reactions;
CREATE POLICY "Authenticated users can react to message" ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can remove own message reaction" ON public.message_reactions;
CREATE POLICY "Users can remove own message reaction" ON public.message_reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 6. Word filter
CREATE TABLE IF NOT EXISTS public.word_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.word_filters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Word filters viewable by everyone" ON public.word_filters;
CREATE POLICY "Word filters viewable by everyone" ON public.word_filters FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage word filters" ON public.word_filters;
CREATE POLICY "Admins can manage word filters" ON public.word_filters FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 7. Scheduled playlists
CREATE TABLE IF NOT EXISTS public.scheduled_playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  scheduled_for timestamptz NOT NULL,
  tracks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.scheduled_playlists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Scheduled playlists viewable by everyone" ON public.scheduled_playlists;
CREATE POLICY "Scheduled playlists viewable by everyone" ON public.scheduled_playlists FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage scheduled playlists" ON public.scheduled_playlists;
CREATE POLICY "Admins can manage scheduled playlists" ON public.scheduled_playlists FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));