-- Playtest with AI — run lifecycle, findings, plan, and rollback snapshot.
--
-- Each row is one "Playtest with AI" run for a project: the user's request,
-- what the scan found, the proposed fix plan (shown for approval), the actions
-- applied through the Studio plugin, and a snapshot of the changed files BEFORE
-- the fix so the run can be rolled back.

CREATE TABLE IF NOT EXISTS public.playtest_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  -- What the user typed ("fix my shop", "make my coins save", ...)
  request text NOT NULL DEFAULT '',

  -- Lifecycle: scanning -> planned -> applying -> verifying -> done | failed | rolled_back
  status text NOT NULL DEFAULT 'scanning'
    CHECK (status IN ('scanning','planned','applying','verifying','done','failed','rolled_back','cancelled')),

  -- Structured scan output: [{ id, severity, title, detail, target, kind }]
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Proposed plan shown to the user before any change:
  -- { summary, steps:[{ id, title, detail, target, actionType }] }
  plan jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- The plugin_actions queued when the plan was approved (ids + a copy).
  applied_actions jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Snapshot of changed files BEFORE applying, for rollback:
  -- [{ path, prior_content, existed }]
  rollback_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Verify pass after fixing: { resolved:boolean, remaining:[findings] }
  verification jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Human-readable final summary of what was fixed.
  summary text,

  credits_spent integer NOT NULL DEFAULT 0,
  error_message text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_playtest_runs_project_time
  ON public.playtest_runs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_playtest_runs_user_time
  ON public.playtest_runs(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.playtest_runs TO authenticated;
GRANT ALL ON public.playtest_runs TO service_role;

ALTER TABLE public.playtest_runs ENABLE ROW LEVEL SECURITY;

-- Owner-scoped: a user only ever sees/creates runs for their own projects.
DROP POLICY IF EXISTS "users read own playtest runs" ON public.playtest_runs;
CREATE POLICY "users read own playtest runs"
  ON public.playtest_runs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users create own playtest runs" ON public.playtest_runs;
CREATE POLICY "users create own playtest runs"
  ON public.playtest_runs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users update own playtest runs" ON public.playtest_runs;
CREATE POLICY "users update own playtest runs"
  ON public.playtest_runs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "service manages playtest runs" ON public.playtest_runs;
CREATE POLICY "service manages playtest runs"
  ON public.playtest_runs FOR ALL TO service_role
  USING (true) WITH CHECK (true);
