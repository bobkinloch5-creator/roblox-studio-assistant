import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CREDIT_COSTS, VIDEO_LIKE_REWARD } from "./credits";

const VIDEO_CREDIT_COST = CREDIT_COSTS.video;

// ---------------------------------------------------------------------------
// CONFIG — the bits most likely to need adjustment after a real API test are
// all here. CometAPI's Seedance video endpoint uses the Volcengine-style
// async task pattern: POST to create a task, GET to poll it.
//
// If the first real generation 404s or returns an unexpected shape, this is
// the block to tweak — not the logic below.
// ---------------------------------------------------------------------------
const COMETAPI_BASE = "https://api.cometapi.com";
const CREATE_TASK_PATH = "/volc/v3/contents/generations/tasks";
const GET_TASK_PATH = "/volc/v3/contents/generations/tasks"; // + "/{taskId}"

// Seedance model id on CometAPI. Their catalog lists "Doubao-Seedance-2-0";
// the API slug has been seen as both of the below across docs, so we keep it
// as a single constant to flip if the first call rejects it.
const SEEDANCE_MODEL = "bytedance-seedance-2-0";

// Default generation params. Seedance 2.0 supports 4–15s clips. We cap the
// default low to control cost (~$0.063/sec → a 5s clip ≈ $0.32).
const DEFAULT_DURATION_S = 5;
const MAX_DURATION_S = 10;
const DEFAULT_RESOLUTION = "1080p";

// Per-user rate limit. One generation per this many days (admins bypass).
// Stored as a row in `video_generations`; we count rows in the window.
const RATE_LIMIT_DAYS = 7;
const RATE_LIMIT_COUNT = 1;

// Polling. The server function returns the task id immediately; the client
// polls a separate status function. But we also do a short inline poll so a
// fast generation can return the URL in one round trip.
const INLINE_POLL_ATTEMPTS = 2;
const INLINE_POLL_INTERVAL_MS = 2500;

export type VideoJobStatus = "queued" | "processing" | "completed" | "failed";

export type VideoJob = {
  taskId: string;
  status: VideoJobStatus;
  videoUrl?: string;
  error?: string;
};

export type RateLimitInfo = {
  allowed: boolean;
  // ISO timestamp when the user may generate again (null if allowed now).
  nextAvailableAt: string | null;
};

function authHeaders(): Record<string, string> {
  const key = process.env.COMETAPI_KEY;
  if (!key) throw new Error("COMETAPI_KEY env var not set on the server.");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function isAdmin(userId: string): Promise<boolean> {
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  return (roles ?? []).some(
    (r: { role: string }) => r.role === "admin" || r.role === "owner",
  );
}

/**
 * Checks whether the user is within their weekly video-generation allowance.
 * Counts completed/queued generations in the trailing window.
 */
async function checkRateLimit(userId: string): Promise<RateLimitInfo> {
  if (await isAdmin(userId)) return { allowed: true, nextAvailableAt: null };

  const since = new Date(Date.now() - RATE_LIMIT_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("video_generations")
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  // If the table doesn't exist yet, don't hard-block the user — allow and
  // let the insert (which will also fail gracefully) be a no-op.
  if (error) {
    if (/relation .*video_generations.* does not exist/i.test(error.message ?? "")) {
      return { allowed: true, nextAvailableAt: null };
    }
    console.warn("[video-gen] rate-limit check failed:", error.message);
    return { allowed: true, nextAvailableAt: null };
  }

  const used = data?.length ?? 0;
  if (used < RATE_LIMIT_COUNT) return { allowed: true, nextAvailableAt: null };

  // Earliest generation in the window + window length = next available.
  const earliest = data![data!.length - 1].created_at as string;
  const nextAvailableAt = new Date(
    new Date(earliest).getTime() + RATE_LIMIT_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  return { allowed: false, nextAvailableAt };
}

async function recordGeneration(userId: string, taskId: string, prompt: string) {
  try {
    const { error } = await supabaseAdmin.from("video_generations").insert({
      user_id: userId,
      task_id: taskId,
      prompt: prompt.slice(0, 1000),
    });
    if (error && !/relation .*video_generations.* does not exist/i.test(error.message ?? "")) {
      console.warn("[video-gen] record failed:", error.message);
    }
  } catch (err) {
    console.warn("[video-gen] record skipped:", err);
  }
}

// Persist the finished video URL onto the generation row so it can later be
// published to the gallery. Best-effort — never throws into the user flow.
async function saveVideoUrl(taskId: string, videoUrl: string) {
  try {
    await supabaseAdmin
      .from("video_generations")
      .update({ video_url: videoUrl })
      .eq("task_id", taskId);
  } catch {
    // ignore — the URL is still returned to the client regardless
  }
}

function parseTaskId(json: any): string | null {
  // CometAPI/Volc returns the task id under a few possible keys depending on
  // the exact endpoint version. Check the common ones.
  return json?.id ?? json?.task_id ?? json?.data?.id ?? json?.data?.task_id ?? null;
}

function parseStatus(json: any): VideoJob {
  const raw =
    json?.status ?? json?.data?.status ?? json?.task?.status ?? "processing";
  const status = String(raw).toLowerCase();

  // Find the video URL across the shapes seen in CometAPI / Volc / AIMLAPI docs.
  const videoUrl =
    json?.video?.url ??
    json?.video_url ??
    json?.data?.video_url ??
    json?.content?.video_url ??
    json?.data?.content?.video_url ??
    json?.result?.video_url ??
    undefined;

  const taskId = parseTaskId(json) ?? "";

  if (status === "completed" || status === "succeeded" || status === "success" || videoUrl) {
    return { taskId, status: "completed", videoUrl };
  }
  if (status === "failed" || status === "error") {
    return {
      taskId,
      status: "failed",
      error: json?.error?.message ?? json?.error ?? "Generation failed.",
    };
  }
  if (status === "queued" || status === "pending") {
    return { taskId, status: "queued" };
  }
  return { taskId, status: "processing" };
}

async function fetchTask(taskId: string): Promise<VideoJob> {
  const res = await fetch(`${COMETAPI_BASE}${GET_TASK_PATH}/${encodeURIComponent(taskId)}`, {
    method: "GET",
    headers: authHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      taskId,
      status: "failed",
      error: json?.error?.message ?? json?.message ?? `Status check failed (${res.status}).`,
    };
  }
  const parsed = parseStatus(json);
  if (parsed.status === "completed" && parsed.videoUrl) {
    await saveVideoUrl(parsed.taskId || taskId, parsed.videoUrl);
  }
  return { ...parsed, taskId: parsed.taskId || taskId };
}

/**
 * Starts a video generation. Enforces the weekly per-user limit, submits the
 * task to CometAPI, records it, then does a short inline poll so quick jobs
 * can return a URL immediately. Slower jobs return a taskId the client polls.
 */
export const startVideoGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const body = (data ?? {}) as {
      prompt?: string;
      durationS?: number;
      resolution?: string;
    };

    const prompt = (body.prompt ?? "").trim();
    if (!prompt) throw new Error("Please enter a prompt describing the video.");
    if (prompt.length > 1500) throw new Error("Prompt is too long (max 1500 characters).");

    const durationS = Math.min(
      MAX_DURATION_S,
      Math.max(1, Math.round(body.durationS ?? DEFAULT_DURATION_S)),
    );
    const resolution = body.resolution ?? DEFAULT_RESOLUTION;

    const admin = await isAdmin(userId);

    // Gate 1: weekly free limit (admins bypass). Reaching the limit does NOT
    // block generation — it only decides whether this run is free or paid.
    const limit = await checkRateLimit(userId);

    // Gate 2: credits. The weekly free generation is free; anything beyond
    // it costs VIDEO_CREDIT_COST. Admins never pay.
    const isFreeThisWeek = limit.allowed;
    const mustPay = !admin && !isFreeThisWeek;
    if (mustPay) {
      const { error } = await supabaseAdmin.rpc("spend_credits_atomic", { _amount: VIDEO_CREDIT_COST });
      if (error) {
        const err = new Error(
          `You've used your free video this week and don't have enough credits (${VIDEO_CREDIT_COST} needed) to generate another.`,
        );
        (err as any).rateLimited = true;
        (err as any).nextAvailableAt = limit.nextAvailableAt;
        throw err;
      }
    }

    const refundIfPaid = async (reason: string) => {
      if (mustPay) {
        await supabaseAdmin.rpc("refund_credits", { _amount: VIDEO_CREDIT_COST, _reason: reason });
      }
    };

    // Submit the task.
    let res: Response;
    try {
      res = await fetch(`${COMETAPI_BASE}${CREATE_TASK_PATH}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          model: SEEDANCE_MODEL,
          content: [{ type: "text", text: prompt }],
          resolution,
          duration_s: durationS,
        }),
      });
    } catch (err) {
      await refundIfPaid("video submit network error");
      throw err;
    }

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      await refundIfPaid("video submit failed");
      throw new Error(
        json?.error?.message ?? json?.message ?? `Video generation failed to start (${res.status}).`,
      );
    }

    const taskId = parseTaskId(json);
    if (!taskId) {
      // Some endpoints return the finished video synchronously.
      const immediate = parseStatus(json);
      if (immediate.videoUrl) {
        await recordGeneration(userId, immediate.taskId || "immediate", prompt);
        return immediate;
      }
      await refundIfPaid("video no task id");
      throw new Error("Could not read a task id from the generation response.");
    }

    await recordGeneration(userId, taskId, prompt);

    // Short inline poll for fast jobs.
    let job: VideoJob = { taskId, status: "queued" };
    for (let i = 0; i < INLINE_POLL_ATTEMPTS; i++) {
      await new Promise((r) => setTimeout(r, INLINE_POLL_INTERVAL_MS));
      job = await fetchTask(taskId);
      if (job.status === "completed" || job.status === "failed") break;
    }
    return job;
  });

/**
 * Polls a previously-started video generation task. Called repeatedly by the
 * client until status is completed or failed.
 */
export const checkVideoGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => {
    const { taskId } = (data ?? {}) as { taskId?: string };
    if (!taskId) throw new Error("Missing task id.");
    return fetchTask(taskId);
  });

/**
 * Returns the user's current rate-limit status so the UI can show a countdown
 * before they even try to generate.
 */
export const getVideoRateLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return checkRateLimit(context.userId);
  });

// ---------------------------------------------------------------------------
// PUBLISHING & GALLERY — creators can publish a finished video to a public
// gallery. Each like another user gives earns the creator credits (capped at
// one like per user per video, enforced by a unique constraint). This is the
// "share what you made for credits" flow.
// ---------------------------------------------------------------------------

export type PublishedVideo = {
  id: string;
  userId: string;
  creatorName: string | null;
  title: string;
  prompt: string | null;
  videoUrl: string;
  likes: number;
  likedByMe: boolean;
  createdAt: string;
};

/**
 * Publishes one of the user's finished videos to the public gallery.
 * Requires that the video belongs to them and has a stored URL.
 */
export const publishVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { taskId, title } = (data ?? {}) as { taskId?: string; title?: string };
    if (!taskId) throw new Error("Missing video reference.");

    const { data: gen, error } = await supabaseAdmin
      .from("video_generations")
      .select("id, user_id, prompt, video_url")
      .eq("task_id", taskId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !gen) throw new Error("Could not find that video in your history.");
    if (!gen.video_url) throw new Error("This video isn't finished yet, so it can't be published.");

    const cleanTitle = (title ?? "").trim().slice(0, 120) || "Untitled clip";

    const { data: row, error: insErr } = await supabaseAdmin
      .from("published_videos")
      .insert({
        user_id: userId,
        source_generation_id: gen.id,
        title: cleanTitle,
        prompt: gen.prompt,
        video_url: gen.video_url,
      })
      .select("id")
      .single();

    if (insErr) {
      if (/duplicate|unique/i.test(insErr.message)) {
        throw new Error("You've already published this video.");
      }
      throw new Error("Could not publish the video. Please try again.");
    }
    return { id: row.id };
  });

/**
 * Returns the public video gallery, newest first, with like counts and
 * whether the current user has liked each one.
 */
export const getVideoGallery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { sort } = (data ?? {}) as { sort?: "recent" | "likes" };

    const orderCol = sort === "likes" ? "likes_count" : "created_at";
    const { data: rows, error } = await supabaseAdmin
      .from("published_videos")
      .select("id, user_id, title, prompt, video_url, likes_count, created_at, profiles(display_name)")
      .order(orderCol, { ascending: false })
      .limit(60);

    if (error) {
      if (/relation .*published_videos.* does not exist/i.test(error.message ?? "")) {
        return { items: [] as PublishedVideo[] };
      }
      throw new Error("Could not load the gallery.");
    }

    // Which of these has the current user liked?
    const ids = (rows ?? []).map((r: any) => r.id);
    let likedSet = new Set<string>();
    if (ids.length) {
      const { data: likes } = await supabaseAdmin
        .from("published_video_likes")
        .select("video_id")
        .eq("user_id", userId)
        .in("video_id", ids);
      likedSet = new Set((likes ?? []).map((l: any) => l.video_id));
    }

    const items: PublishedVideo[] = (rows ?? []).map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      creatorName: r.profiles?.display_name ?? null,
      title: r.title,
      prompt: r.prompt,
      videoUrl: r.video_url,
      likes: r.likes_count ?? 0,
      likedByMe: likedSet.has(r.id),
      createdAt: r.created_at,
    }));
    return { items };
  });

/**
 * Toggles a like on a published video. On a NEW like (not a re-like, not the
 * creator liking their own), the creator earns VIDEO_LIKE_REWARD credits.
 * The unique (video_id, user_id) row prevents like-farming.
 */
export const likeVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { videoId } = (data ?? {}) as { videoId?: string };
    if (!videoId) throw new Error("Missing video id.");

    const { data: vid, error: vidErr } = await supabaseAdmin
      .from("published_videos")
      .select("id, user_id, likes_count")
      .eq("id", videoId)
      .maybeSingle();
    if (vidErr || !vid) throw new Error("Video not found.");

    // Already liked? Then this is an unlike (toggle off). No credit change —
    // we don't claw back the reward, to keep it simple and non-punitive.
    const { data: existing } = await supabaseAdmin
      .from("published_video_likes")
      .select("video_id")
      .eq("video_id", videoId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("published_video_likes")
        .delete()
        .eq("video_id", videoId)
        .eq("user_id", userId);
      await supabaseAdmin
        .from("published_videos")
        .update({ likes_count: Math.max(0, (vid.likes_count ?? 1) - 1) })
        .eq("id", videoId);
      return { liked: false, likes: Math.max(0, (vid.likes_count ?? 1) - 1) };
    }

    // New like.
    const { error: likeErr } = await supabaseAdmin
      .from("published_video_likes")
      .insert({ video_id: videoId, user_id: userId });
    if (likeErr) {
      // Unique violation = race; treat as already-liked.
      if (/duplicate|unique/i.test(likeErr.message)) {
        return { liked: true, likes: vid.likes_count ?? 0 };
      }
      throw new Error("Could not like the video.");
    }

    const newCount = (vid.likes_count ?? 0) + 1;
    await supabaseAdmin
      .from("published_videos")
      .update({ likes_count: newCount })
      .eq("id", videoId);

    // Reward the creator — but never for liking your own video.
    if (vid.user_id !== userId) {
      await supabaseAdmin.rpc("grant_credits_service", {
        _user_id: vid.user_id,
        _amount: VIDEO_LIKE_REWARD,
        _reason: "video like reward",
      });
    }

    return { liked: true, likes: newCount };
  });
