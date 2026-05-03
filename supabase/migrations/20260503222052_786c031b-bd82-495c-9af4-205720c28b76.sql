-- Trigger: when a pending item is inserted and nothing is playing, start it
DROP TRIGGER IF EXISTS trg_maybe_start_playback ON public.queue;
CREATE TRIGGER trg_maybe_start_playback
AFTER INSERT ON public.queue
FOR EACH ROW
EXECUTE FUNCTION public.maybe_start_playback();

-- Make advance_queue robust: if there's no "current" but pending exists, start it
CREATE OR REPLACE FUNCTION public.advance_queue(expected_current uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_id uuid;
  next_row public.queue%ROWTYPE;
BEGIN
  SELECT current_queue_id INTO current_id
  FROM public.playback_state
  WHERE id = 1
  FOR UPDATE;

  -- Race guard only when there IS a current track to compare against
  IF current_id IS NOT NULL AND expected_current IS NOT NULL AND current_id IS DISTINCT FROM expected_current THEN
    RETURN current_id;
  END IF;

  IF current_id IS NOT NULL THEN
    UPDATE public.queue SET status = 'played' WHERE id = current_id AND status = 'playing';
  END IF;

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
$function$;