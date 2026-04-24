-- Add guest_name to messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS guest_name text;

-- Allow guests (anon) to insert messages with guest_name and no user_id
DROP POLICY IF EXISTS "Guests can send chat messages" ON public.messages;
CREATE POLICY "Guests can send chat messages" ON public.messages FOR INSERT TO anon
  WITH CHECK (user_id IS NULL AND guest_name IS NOT NULL AND length(guest_name) BETWEEN 1 AND 40 AND type = 'chat');

-- Rebuild scheduled_playlists with the correct shape
DROP TABLE IF EXISTS public.scheduled_playlists CASCADE;
CREATE TABLE public.scheduled_playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_hour int NOT NULL CHECK (start_hour BETWEEN 0 AND 23),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.scheduled_playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scheduled playlists viewable by everyone" ON public.scheduled_playlists FOR SELECT USING (true);
CREATE POLICY "Admins can manage scheduled playlists" ON public.scheduled_playlists FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));