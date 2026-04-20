-- Phase 4 migrations: word_filters, scheduled_playlists, queue_upvotes

-- 1. Create word_filters table
CREATE TABLE IF NOT EXISTS public.word_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.word_filters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage word filters" ON public.word_filters
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Anyone can read word filters" ON public.word_filters FOR SELECT USING (true);

-- 2. Create scheduled_playlists table
CREATE TABLE IF NOT EXISTS public.scheduled_playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_hour INT NOT NULL CHECK (start_hour >= 0 AND start_hour <= 23),
  items JSONB NOT NULL DEFAULT '[]',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage scheduled playlists" ON public.scheduled_playlists
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Anyone can read scheduled playlists" ON public.scheduled_playlists FOR SELECT USING (true);

-- 3. Create queue_upvotes table
CREATE TABLE IF NOT EXISTS public.queue_upvotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID NOT NULL REFERENCES public.queue(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (queue_id, user_id)
);

ALTER TABLE public.queue_upvotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read queue upvotes" ON public.queue_upvotes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can upvote" ON public.queue_upvotes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their upvote" ON public.queue_upvotes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. Scheduled playlists trigger (runs via pg_cron hourly)
CREATE OR REPLACE FUNCTION public.cron_run_scheduled_playlists()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  playlist RECORD;
  item JSONB;
  position_base BIGINT := extract(epoch from now())::bigint * 1000;
  idx INT;
BEGIN
  FOR playlist IN
    SELECT * FROM public.scheduled_playlists
    WHERE active = true
      AND day_of_week = extract(dow from now())
      AND start_hour = extract(hour from now())
  LOOP
    -- Clear existing pending items
    DELETE FROM public.queue WHERE status = 'pending';

    -- Insert playlist items
    idx := 0;
    FOR item IN SELECT * FROM jsonb_array_elements(playlist.items)
    LOOP
      INSERT INTO public.queue (source, external_id, title, artist, thumbnail, status, position)
      VALUES (
        'youtube',
        item->>'videoId',
        item->>'title',
        item->>'channel',
        item->>'thumbnail',
        'pending',
        position_base + idx * 1000
      );
      idx := idx + 1;
    END LOOP;
  END LOOP;
END;
$$;

-- NOTE: Run in Supabase SQL Editor after enabling pg_cron:
-- SELECT cron.schedule('run-scheduled-playlists', '0 * * * *', 'SELECT public.cron_run_scheduled_playlists()');
