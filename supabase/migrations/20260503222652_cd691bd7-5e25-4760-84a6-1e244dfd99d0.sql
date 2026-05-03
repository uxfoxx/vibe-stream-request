-- Ensure realtime sees full row data on UPDATE/DELETE
ALTER TABLE public.playback_state REPLICA IDENTITY FULL;
ALTER TABLE public.queue           REPLICA IDENTITY FULL;
ALTER TABLE public.messages        REPLICA IDENTITY FULL;
ALTER TABLE public.skip_votes      REPLICA IDENTITY FULL;
ALTER TABLE public.queue_upvotes   REPLICA IDENTITY FULL;
ALTER TABLE public.track_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;

-- Add tables to the realtime publication if not already there
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='playback_state') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.playback_state';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='queue') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.queue';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='messages') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='skip_votes') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.skip_votes';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='queue_upvotes') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_upvotes';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='track_reactions') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.track_reactions';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='message_reactions') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions';
  END IF;
END $$;