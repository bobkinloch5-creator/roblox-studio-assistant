-- Store the finished video URL on the generation row so it can be published.
ALTER TABLE public.video_generations
  ADD COLUMN IF NOT EXISTS video_url text NULL;

-- Public gallery of published videos.
CREATE TABLE IF NOT EXISTS public.published_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_generation_id uuid NULL,
  title text NOT NULL,
  prompt text NULL,
  video_url text NOT NULL,
  likes_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One published row per source generation (prevents double-publishing).
CREATE UNIQUE INDEX IF NOT EXISTS published_videos_source_unique
  ON public.published_videos(source_generation_id)
  WHERE source_generation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS published_videos_created_idx
  ON public.published_videos(created_at DESC);
CREATE INDEX IF NOT EXISTS published_videos_likes_idx
  ON public.published_videos(likes_count DESC);

-- Likes — unique per (video, user) so a user can like a video only once.
-- This is what keeps the creator like-reward from being farmable.
CREATE TABLE IF NOT EXISTS public.published_video_likes (
  video_id uuid NOT NULL REFERENCES public.published_videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, user_id)
);

ALTER TABLE public.published_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.published_video_likes ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.published_videos TO service_role;
GRANT ALL ON public.published_video_likes TO service_role;

-- Server functions (service role) do all writes. Anyone signed in may read
-- the public gallery; likes are managed server-side only.
CREATE POLICY "service role manages published videos"
ON public.published_videos FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "anyone can read published videos"
ON public.published_videos FOR SELECT
USING (true);

CREATE POLICY "service role manages video likes"
ON public.published_video_likes FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "users read own video likes"
ON public.published_video_likes FOR SELECT
USING (auth.uid() = user_id);
