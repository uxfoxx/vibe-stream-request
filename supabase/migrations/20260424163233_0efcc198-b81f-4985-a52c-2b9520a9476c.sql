-- 1. Trigger to keep playback_state.updated_at fresh
CREATE OR REPLACE FUNCTION public.touch_playback_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS playback_state_touch ON public.playback_state;
CREATE TRIGGER playback_state_touch
BEFORE UPDATE ON public.playback_state
FOR EACH ROW EXECUTE FUNCTION public.touch_playback_state();

-- 2. Normalize queue.position default to milliseconds
ALTER TABLE public.queue
  ALTER COLUMN position SET DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint;

-- 3. Backfill: any position < 1e12 is in seconds; convert to ms
UPDATE public.queue
SET position = position * 1000
WHERE position < 1000000000000;

-- 4. Cleanup: ensure only one row has status='playing' (keep the one referenced by playback_state)
UPDATE public.queue
SET status = 'played'
WHERE status = 'playing'
  AND id NOT IN (
    SELECT current_queue_id FROM public.playback_state WHERE current_queue_id IS NOT NULL
  );

-- 5. Atomic advance_queue function — kills the race
CREATE OR REPLACE FUNCTION public.advance_queue(expected_current uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_id uuid;
  next_row public.queue%ROWTYPE;
BEGIN
  -- Lock the singleton playback_state row
  SELECT current_queue_id INTO current_id
  FROM public.playback_state
  WHERE id = 1
  FOR UPDATE;

  -- Race guard: if caller expected a specific current track and it's already moved on, exit
  IF expected_current IS NOT NULL AND current_id IS DISTINCT FROM expected_current THEN
    RETURN current_id;
  END IF;

  -- Mark current track played
  IF current_id IS NOT NULL THEN
    UPDATE public.queue SET status = 'played' WHERE id = current_id AND status = 'playing';
  END IF;

  -- Find next pending track
  SELECT * INTO next_row
  FROM public.queue
  WHERE status = 'pending'
  ORDER BY position ASC
  LIMIT 1;

  IF next_row.id IS NULL THEN
    UPDATE public.playback_state
    SET current_queue_id = NULL, started_at = NULL, is_playing = false
    WHERE id = 1;
    RETURN NULL;
  END IF;

  UPDATE public.queue SET status = 'playing' WHERE id = next_row.id;
  UPDATE public.playback_state
  SET current_queue_id = next_row.id,
      started_at = now(),
      is_playing = true
  WHERE id = 1;

  RETURN next_row.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.advance_queue(uuid) TO authenticated, anon;