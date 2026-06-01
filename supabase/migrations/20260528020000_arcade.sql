-- Per-user best scores per game (for the leaderboard + "beat your best" logic).
CREATE TABLE IF NOT EXISTS public.arcade_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  game text NOT NULL,
  score integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS arcade_scores_game_score_idx
  ON public.arcade_scores(game, score DESC);
CREATE INDEX IF NOT EXISTS arcade_scores_user_game_idx
  ON public.arcade_scores(user_id, game, score DESC);

-- Ledger of every credit awarded from arcade play. This is the anti-abuse
-- backbone: the daily cap is enforced by counting rows here within the day,
-- so even if the client is tampered with, a user cannot exceed the cap.
CREATE TABLE IF NOT EXISTS public.arcade_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  game text NOT NULL,
  score integer NOT NULL,
  credits_awarded integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS arcade_rewards_user_day_idx
  ON public.arcade_rewards(user_id, created_at DESC);

ALTER TABLE public.arcade_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arcade_rewards ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.arcade_scores TO service_role;
GRANT ALL ON public.arcade_rewards TO service_role;

-- All writes go through service-role server functions. Anyone signed in can
-- read the leaderboard; reward rows are readable by their owner only.
CREATE POLICY "service role manages arcade scores"
ON public.arcade_scores FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "anyone reads arcade scores"
ON public.arcade_scores FOR SELECT
USING (true);

CREATE POLICY "service role manages arcade rewards"
ON public.arcade_rewards FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "users read own arcade rewards"
ON public.arcade_rewards FOR SELECT
USING (auth.uid() = user_id);
