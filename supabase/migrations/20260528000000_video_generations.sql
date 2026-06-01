CREATE TABLE IF NOT EXISTS public.video_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_id text NOT NULL,
  prompt text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS video_generations_user_created_idx
  ON public.video_generations(user_id, created_at DESC);

ALTER TABLE public.video_generations ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.video_generations TO service_role;

-- The server functions run with the service role and do all reads/writes.
-- Users may read their own rows (e.g. a history view) but never insert
-- directly, which keeps the rate limit honest.
CREATE POLICY "service role manages video generations"
ON public.video_generations FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "users read own video generations"
ON public.video_generations FOR SELECT
USING (auth.uid() = user_id);
