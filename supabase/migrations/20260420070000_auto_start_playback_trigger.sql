-- Auto-start playback when a track is added to the queue and nothing is playing.
-- Runs as SECURITY DEFINER so it bypasses RLS regardless of who inserted the row.

CREATE OR REPLACE FUNCTION public.maybe_start_playback()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Only act on pending inserts
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- If nothing is currently playing, start this track immediately
  IF EXISTS (
    SELECT 1 FROM public.playback_state WHERE id = 1 AND current_queue_id IS NULL
  ) THEN
    UPDATE public.queue SET status = 'playing' WHERE id = NEW.id;
    UPDATE public.playback_state
    SET current_queue_id = NEW.id,
        started_at        = now(),
        is_playing        = true
    WHERE id = 1 AND current_queue_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_queue_insert_start_playback
  AFTER INSERT ON public.queue
  FOR EACH ROW EXECUTE FUNCTION public.maybe_start_playback();
