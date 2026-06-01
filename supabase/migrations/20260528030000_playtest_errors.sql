CREATE TABLE IF NOT EXISTS public.playtest_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  message text NOT NULL,
  kind text NOT NULL DEFAULT 'error',
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS playtest_errors_project_idx
  ON public.playtest_errors(project_id, created_at DESC);

ALTER TABLE public.playtest_errors ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.playtest_errors TO service_role;

CREATE POLICY "service role manages playtest errors"
ON public.playtest_errors FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "users read own project playtest errors"
ON public.playtest_errors FOR SELECT
USING (auth.uid() = user_id);
