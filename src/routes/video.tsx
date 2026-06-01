import { createFileRoute, redirect } from "@tanstack/react-router";
import { Header, Footer } from "@/components/layout";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useRef, useCallback } from "react";
import { Film, Loader2, Download, Clock, Sparkles, AlertCircle, Heart, Upload, Check } from "lucide-react";
import { CREDIT_COSTS, VIDEO_LIKE_REWARD } from "@/lib/credits";
import {
  startVideoGeneration,
  checkVideoGeneration,
  getVideoRateLimit,
  publishVideo,
  getVideoGallery,
  likeVideo,
  type VideoJob,
  type RateLimitInfo,
  type PublishedVideo,
} from "@/lib/video-gen.functions";

export const Route = createFileRoute("/video")({
  beforeLoad: async ({ context }) => {
    // Must be signed in. The auth context is populated by the root loader;
    // if there's no user, send them to login.
    const ctx = context as { user?: unknown } | undefined;
    if (ctx && "user" in ctx && !ctx.user) {
      throw redirect({ to: "/login" });
    }
  },
  component: VideoPage,
  head: () => ({
    meta: [
      { title: "AI Video Generation — BloxSmith" },
      {
        name: "description",
        content:
          "Generate cinematic video clips for your Roblox game trailers and cutscenes with AI.",
      },
    ],
  }),
});

const DURATIONS = [3, 5, 8, 10];
const RESOLUTIONS = ["720p", "1080p"];

function VideoPage() {
  const start = useServerFn(startVideoGeneration) as any;
  const check = useServerFn(checkVideoGeneration) as any;
  const getLimit = useServerFn(getVideoRateLimit) as any;
  const doPublish = useServerFn(publishVideo) as any;
  const fetchGallery = useServerFn(getVideoGallery) as any;
  const doLike = useServerFn(likeVideo) as any;

  const [prompt, setPrompt] = useState("");
  const [durationS, setDurationS] = useState(5);
  const [resolution, setResolution] = useState("1080p");
  const [job, setJob] = useState<VideoJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState<RateLimitInfo | null>(null);
  const [now, setNow] = useState(Date.now());
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Publish + gallery state.
  const [publishTitle, setPublishTitle] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [gallery, setGallery] = useState<PublishedVideo[]>([]);
  const [gallerySort, setGallerySort] = useState<"recent" | "likes">("recent");

  const loadGallery = useCallback(
    (sort: "recent" | "likes") => {
      fetchGallery({ data: { sort } })
        .then((r: any) => setGallery(r.items as PublishedVideo[]))
        .catch(() => {});
    },
    [fetchGallery],
  );

  useEffect(() => {
    loadGallery(gallerySort);
  }, [loadGallery, gallerySort]);

  async function onPublish() {
    if (!job?.taskId) return;
    setPublishing(true);
    try {
      await doPublish({ data: { taskId: job.taskId, title: publishTitle } });
      setPublished(true);
      loadGallery(gallerySort);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish.");
    } finally {
      setPublishing(false);
    }
  }

  async function onLike(v: PublishedVideo) {
    // Optimistic toggle.
    setGallery((g) =>
      g.map((x) =>
        x.id === v.id
          ? { ...x, likedByMe: !x.likedByMe, likes: x.likes + (x.likedByMe ? -1 : 1) }
          : x,
      ),
    );
    try {
      const r = (await doLike({ data: { videoId: v.id } })) as { liked: boolean; likes: number };
      setGallery((g) => g.map((x) => (x.id === v.id ? { ...x, likedByMe: r.liked, likes: r.likes } : x)));
    } catch {
      // Revert on failure.
      loadGallery(gallerySort);
    }
  }

  // Load the rate-limit status on mount so we can show a countdown before
  // the user even tries.
  useEffect(() => {
    getLimit({ data: {} })
      .then((r: any) => setLimit(r as RateLimitInfo))
      .catch(() => setLimit(null));
  }, [getLimit]);

  // Tick every second to drive the countdown.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Clean up any pending poll on unmount.
  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  const poll = useCallback(
    (taskId: string) => {
      pollRef.current = setTimeout(async () => {
        try {
          const next = (await check({ data: { taskId } })) as VideoJob;
          setJob(next);
          if (next.status === "completed" || next.status === "failed") {
            setBusy(false);
            if (next.status === "failed") setError(next.error ?? "Generation failed.");
            // Refresh the rate limit after a finished generation.
            getLimit({ data: {} }).then((r: any) => setLimit(r as RateLimitInfo)).catch(() => {});
          } else {
            poll(taskId);
          }
        } catch (err) {
          setBusy(false);
          setError(err instanceof Error ? err.message : "Failed to check status.");
        }
      }, 3000);
    },
    [check, getLimit],
  );

  async function generate() {
    setError(null);
    setJob(null);
    setPublished(false);
    setPublishTitle("");
    setBusy(true);
    try {
      const result = (await start({
        data: { prompt, durationS, resolution },
      })) as VideoJob;
      setJob(result);
      if (result.status === "completed" || result.status === "failed") {
        setBusy(false);
        if (result.status === "failed") setError(result.error ?? "Generation failed.");
        getLimit({ data: {} }).then((r: any) => setLimit(r as RateLimitInfo)).catch(() => {});
      } else {
        poll(result.taskId);
      }
    } catch (err: any) {
      setBusy(false);
      setError(err?.message ?? "Failed to start generation.");
      // If it was a rate-limit error, refresh the limit display.
      if (err?.rateLimited) {
        getLimit({ data: {} }).then((r: any) => setLimit(r as RateLimitInfo)).catch(() => {});
      }
    }
  }

  // The weekly free run being used up does NOT block generation — it just
  // means the next one costs credits (the server enforces the balance).
  const weeklyUsed = !!(limit && !limit.allowed && limit.nextAvailableAt);
  const countdown = weeklyUsed ? formatCountdown(new Date(limit!.nextAvailableAt!).getTime() - now) : null;
  const canGenerate = !busy && prompt.trim().length > 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 py-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-primary/15 grid place-items-center">
            <Film className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">AI Video Generation</h1>
            <p className="text-sm text-muted-foreground">
              Cinematic clips for game trailers and cutscenes, powered by Seedance.
            </p>
          </div>
        </div>

        {/* Weekly free run used — generation still allowed, costs credits */}
        {weeklyUsed && (
          <div className="mt-4 rounded-xl border border-border bg-surface-elevated/40 p-4 flex items-start gap-3">
            <Clock className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="text-sm">
              <div className="font-medium">Free weekly video used</div>
              <div className="text-muted-foreground text-xs mt-0.5">
                Your next free video unlocks in <span className="font-mono text-foreground">{countdown}</span>.
                Until then, each video costs <span className="text-foreground">{CREDIT_COSTS.video} credits</span>.
              </div>
            </div>
          </div>
        )}

        {/* Prompt + controls */}
        <div className="mt-4 rounded-2xl border border-border bg-surface-elevated/40 p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Describe your video</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={1500}
              rows={4}
              placeholder="A sweeping aerial shot over a neon cyberpunk city at night, camera flying between skyscrapers, cinematic lighting…"
              disabled={busy}
              className="mt-1.5 w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm focus:outline-none focus:border-primary/50 resize-none disabled:opacity-50"
            />
            <div className="text-[10px] text-muted-foreground text-right mt-1">{prompt.length}/1500</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Length</label>
              <div className="mt-1.5 flex gap-1.5">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    disabled={busy}
                    onClick={() => setDurationS(d)}
                    className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition disabled:opacity-50 ${
                      durationS === d
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background/40 text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Quality</label>
              <div className="mt-1.5 flex gap-1.5">
                {RESOLUTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    disabled={busy}
                    onClick={() => setResolution(r)}
                    className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition disabled:opacity-50 ${
                      resolution === r
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background/40 text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={generate}
            disabled={!canGenerate}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition disabled:opacity-40"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Generate video
              </>
            )}
          </button>

          <p className="text-[10px] text-muted-foreground text-center">
            1 free video per week, then {CREDIT_COSTS.video} credits each. Generation takes 1–3 minutes.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Progress / result */}
        {job && (
          <div className="mt-4 rounded-2xl border border-border bg-surface-elevated/40 p-4">
            {job.status !== "completed" && job.status !== "failed" && (
              <div className="flex flex-col items-center py-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                <div className="text-sm font-medium capitalize">{job.status}…</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Rendering your clip — this usually takes 1–3 minutes. You can stay on this page.
                </div>
                <div className="mt-4 h-1.5 w-full max-w-xs rounded-full bg-background/60 overflow-hidden">
                  <div className="h-full w-1/3 rounded-full bg-primary animate-pulse" />
                </div>
              </div>
            )}

            {job.status === "completed" && job.videoUrl && (
              <div className="space-y-3">
                <video
                  src={job.videoUrl}
                  controls
                  autoPlay
                  loop
                  className="w-full rounded-lg border border-border bg-black"
                />
                <a
                  href={job.videoUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background/60 px-4 py-2.5 text-sm font-medium hover:border-primary/50 transition"
                >
                  <Download className="h-4 w-4" /> Download video
                </a>

                {/* Publish to gallery — share for credits */}
                {published ? (
                  <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    Published to the gallery! You'll earn {VIDEO_LIKE_REWARD} credit each time someone likes it.
                  </div>
                ) : (
                  <div className="rounded-lg border border-border bg-background/40 p-3 space-y-2">
                    <div className="text-xs font-medium">Share this for credits</div>
                    <p className="text-[11px] text-muted-foreground">
                      Publish to the public gallery and earn {VIDEO_LIKE_REWARD} credit every time another creator likes it.
                    </p>
                    <input
                      type="text"
                      value={publishTitle}
                      onChange={(e) => setPublishTitle(e.target.value)}
                      maxLength={120}
                      placeholder="Give it a title…"
                      className="w-full rounded-md border border-border bg-background/60 px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary/50"
                    />
                    <button
                      type="button"
                      onClick={onPublish}
                      disabled={publishing}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition disabled:opacity-50"
                    >
                      {publishing ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Publishing…
                        </>
                      ) : (
                        <>
                          <Upload className="h-3.5 w-3.5" /> Publish to gallery
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {job.status === "completed" && !job.videoUrl && (
              <div className="text-sm text-muted-foreground text-center py-4">
                Generation finished but no video URL was returned. Please try again.
              </div>
            )}
          </div>
        )}
        {/* Community gallery */}
        <section className="mt-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">Community gallery</h2>
            <div className="flex gap-1.5">
              {(["recent", "likes"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setGallerySort(s)}
                  className={`rounded-md border px-2.5 py-1 text-xs transition ${
                    gallerySort === s
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-background/40 text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {s === "recent" ? "Recent" : "Most liked"}
                </button>
              ))}
            </div>
          </div>

          {gallery.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface-elevated/40 p-8 text-center text-sm text-muted-foreground">
              No published videos yet. Generate one and be the first to share it!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {gallery.map((v) => (
                <div key={v.id} className="rounded-xl border border-border bg-surface-elevated/40 overflow-hidden flex flex-col">
                  <video
                    src={v.videoUrl}
                    controls
                    loop
                    muted
                    playsInline
                    className="w-full aspect-video bg-black object-cover"
                  />
                  <div className="p-3 flex-1 flex flex-col">
                    <div className="font-medium text-sm leading-tight">{v.title}</div>
                    {v.creatorName && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">by {v.creatorName}</div>
                    )}
                    <div className="mt-auto pt-2 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => onLike(v)}
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition ${
                          v.likedByMe
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        <Heart className={`h-3.5 w-3.5 ${v.likedByMe ? "fill-current" : ""}`} />
                        {v.likes}
                      </button>
                      <a
                        href={v.videoUrl}
                        download
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                      >
                        <Download className="h-3 w-3" /> Save
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0s";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}
