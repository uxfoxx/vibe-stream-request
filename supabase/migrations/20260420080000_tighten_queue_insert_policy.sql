-- Tighten queue INSERT policy to match messages INSERT — block banned users
DROP POLICY IF EXISTS "Authenticated users can insert (request) songs" ON public.queue;

CREATE POLICY "Authenticated non-banned users can insert songs" ON public.queue FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND banned = true
    )
  );
