-- Phase 1 migrations: pg_cron auto-advance, skip_votes, temp_ban

-- 1. Enable pg_cron (must be run as superuser via Supabase SQL Editor)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Add upvotes + skip_vote_count columns to queue
ALTER TABLE public.queue
  ADD COLUMN IF NOT EXISTS upvotes INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skip_vote_count INT NOT NULL DEFAULT 0;

-- 3. Add temp_ban_until + ban_reason to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS temp_ban_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ban_reason TEXT;

-- 4. Create skip_votes table
CREATE TABLE IF NOT EXISTS public.skip_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID NOT NULL REFERENCES public.queue(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (queue_id, user_id)
);

ALTER TABLE public.skip_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read skip_votes" ON public.skip_votes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can skip vote" ON public.skip_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own skip vote" ON public.skip_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 5. DB trigger: auto-advance when skip threshold reached (server-side, no admin needed)
CREATE OR REPLACE FUNCTION public.check_skip_threshold()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vote_count INT;
  skip_threshold INT := 3;
  cur_state RECORD;
  next_item RECORD;
BEGIN
  SELECT COUNT(*) INTO vote_count FROM public.skip_votes WHERE queue_id = NEW.queue_id;
  IF vote_count < skip_threshold THEN RETURN NEW; END IF;

  SELECT * INTO cur_state FROM public.playback_state WHERE id = 1;
  IF cur_state.current_queue_id IS NULL OR cur_state.current_queue_id != NEW.queue_id THEN RETURN NEW; END IF;

  -- Advance queue
  UPDATE public.queue SET status = 'skipped' WHERE id = NEW.queue_id;
  DELETE FROM public.skip_votes WHERE queue_id = NEW.queue_id;

  SELECT * INTO next_item FROM public.queue WHERE status = 'pending' ORDER BY position ASC LIMIT 1;
  IF next_item IS NOT NULL THEN
    UPDATE public.queue SET status = 'playing' WHERE id = next_item.id;
    UPDATE public.playback_state SET
      current_queue_id = next_item.id,
      started_at = now(),
      is_playing = true
    WHERE id = 1;
  ELSE
    UPDATE public.playback_state SET
      current_queue_id = NULL,
      started_at = NULL,
      is_playing = false
    WHERE id = 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_skip_vote_check_threshold ON public.skip_votes;
CREATE TRIGGER on_skip_vote_check_threshold
  AFTER INSERT ON public.skip_votes
  FOR EACH ROW EXECUTE FUNCTION public.check_skip_threshold();

-- 6. Queue auto-advance function for pg_cron
CREATE OR REPLACE FUNCTION public.cron_advance_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur_state RECORD;
  cur_track RECORD;
  next_item RECORD;
BEGIN
  SELECT * INTO cur_state FROM public.playback_state WHERE id = 1;
  IF NOT FOUND OR NOT cur_state.is_playing OR cur_state.current_queue_id IS NULL OR cur_state.started_at IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO cur_track FROM public.queue WHERE id = cur_state.current_queue_id;
  IF NOT FOUND OR cur_track.duration_seconds IS NULL THEN RETURN; END IF;

  -- Check if track should be over (with 5-second buffer)
  IF (cur_state.started_at + (cur_track.duration_seconds || ' seconds')::interval + interval '5 seconds') > now() THEN
    RETURN;
  END IF;

  -- Advance queue
  UPDATE public.queue SET status = 'played' WHERE id = cur_state.current_queue_id;

  SELECT * INTO next_item FROM public.queue WHERE status = 'pending' ORDER BY position ASC LIMIT 1;
  IF next_item IS NOT NULL THEN
    UPDATE public.queue SET status = 'playing' WHERE id = next_item.id;
    UPDATE public.playback_state SET
      current_queue_id = next_item.id,
      started_at = now(),
      is_playing = true
    WHERE id = 1;
  ELSE
    UPDATE public.playback_state SET
      current_queue_id = NULL,
      started_at = NULL,
      is_playing = false
    WHERE id = 1;
  END IF;
END;
$$;

-- NOTE: Run this in Supabase SQL Editor after enabling pg_cron:
-- SELECT cron.schedule('advance-queue', '* * * * *', 'SELECT public.cron_advance_queue()');

-- 7. Update messages INSERT policy to also respect temp bans
DROP POLICY IF EXISTS "Authenticated non-banned users can send messages" ON public.messages;
CREATE POLICY "Authenticated non-banned users can send messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (banned = true OR (temp_ban_until IS NOT NULL AND temp_ban_until > now()))
    )
  );

-- 8. Allow users to delete their own pending queue items
DROP POLICY IF EXISTS "Users can remove their own pending requests" ON public.queue;
CREATE POLICY "Users can remove their own pending requests" ON public.queue
  FOR DELETE TO authenticated
  USING (requested_by = auth.uid() AND status = 'pending');
