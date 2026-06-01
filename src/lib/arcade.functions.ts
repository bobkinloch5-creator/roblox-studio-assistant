import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createHmac, randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// ANTI-ABUSE MODEL
//
// Browser games can't be trusted — a determined user can call the submit
// endpoint with any score. So credits are protected by layered guards, none
// of which rely on the client being honest:
//
//   1. DAILY CAP. At most ARCADE_DAILY_CAP credits per user per day, counted
//      from the arcade_rewards ledger server-side. This bounds worst-case
//      abuse to a trivial amount no matter what the client sends.
//   2. SIGNED SESSION. A score submission must carry a token issued by
//      startArcadeSession, HMAC-signed with a server secret and stamped with
//      a start time. This stops blind endpoint-poking without a session.
//   3. PLAUSIBILITY. Score must be consistent with elapsed wall-time (you
//      can't score 10,000 in 3 seconds) and under a per-game ceiling.
//   4. BEAT-YOUR-BEST. Credits are only awarded for improving your own
//      previous best for that game — re-submitting the same score earns 0.
//   5. PER-GAME REWARD CHUNKS. Each qualifying improvement earns a small
//      fixed amount, so even within the daily cap it's slow.
//
// Net effect: honest skilled players earn a couple credits a day; cheaters
// also cap out at a couple credits a day. The economy stays safe.
// ---------------------------------------------------------------------------

export const ARCADE_GAMES = ["space-shooter", "brick-breaker", "snake"] as const;
export type ArcadeGame = (typeof ARCADE_GAMES)[number];

// Hard ceiling on credits earned from all arcade games combined, per day.
const ARCADE_DAILY_CAP = 2;
// Credits granted per qualifying "new personal best" submission.
const REWARD_PER_IMPROVEMENT = 1;

// Minimum score improvement (over previous best) required to earn a reward,
// so tiny +1 nudges don't each pay out.
const MIN_IMPROVEMENT: Record<ArcadeGame, number> = {
  "space-shooter": 250,
  "brick-breaker": 150,
  snake: 30,
};

// Plausibility ceilings: maximum believable score-per-second for each game.
// Used to reject impossibly high scores for the time played.
const MAX_SCORE_PER_SECOND: Record<ArcadeGame, number> = {
  "space-shooter": 120,
  "brick-breaker": 60,
  snake: 8,
};

// Absolute per-game score ceiling — a hard sanity cap regardless of time.
const MAX_SCORE: Record<ArcadeGame, number> = {
  "space-shooter": 100000,
  "brick-breaker": 50000,
  snake: 5000,
};

// Session tokens expire after this long — a session must be submitted within
// a reasonable play window.
const SESSION_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_MIN_AGE_MS = 3 * 1000; // must play at least 3s

function sessionSecret(): string {
  // Reuse an existing server secret if present, else fall back to a build
  // constant. The token only gates arcade credits, so this isn't high-stakes,
  // but using a real secret when available is better.
  return (
    process.env.ARCADE_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEOKENS_API_KEY ||
    "bloxsmith-arcade-fallback-secret"
  );
}

function signSession(game: string, userId: string, nonce: string, startedAt: number): string {
  const payload = `${game}.${userId}.${nonce}.${startedAt}`;
  const sig = createHmac("sha256", sessionSecret()).update(payload).digest("hex").slice(0, 32);
  return `${nonce}.${startedAt}.${sig}`;
}

function verifySession(token: string, game: string, userId: string): { ok: boolean; startedAt?: number } {
  const parts = (token ?? "").split(".");
  if (parts.length !== 3) return { ok: false };
  const [nonce, startedAtStr, sig] = parts;
  const startedAt = Number(startedAtStr);
  if (!Number.isFinite(startedAt)) return { ok: false };
  const expected = signSession(game, userId, nonce, startedAt).split(".")[2];
  if (expected !== sig) return { ok: false };
  return { ok: true, startedAt };
}

function dayStartIso(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

async function creditsEarnedToday(userId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("arcade_rewards")
    .select("credits_awarded")
    .eq("user_id", userId)
    .gte("created_at", dayStartIso());
  if (error) {
    // If the table is missing, treat as cap reached (fail safe — don't pay).
    if (/relation .*arcade_rewards.* does not exist/i.test(error.message ?? "")) return ARCADE_DAILY_CAP;
    return ARCADE_DAILY_CAP;
  }
  return (data ?? []).reduce((sum, r: any) => sum + (r.credits_awarded ?? 0), 0);
}

async function previousBest(userId: string, game: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("arcade_scores")
    .select("score")
    .eq("user_id", userId)
    .eq("game", game)
    .order("score", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.score ?? 0;
}

/**
 * Issues a signed session token the client must hold for the duration of a
 * game and send back with the final score. Stamps the start time so the
 * server can check elapsed-time plausibility on submit.
 */
export const startArcadeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { game } = (data ?? {}) as { game?: string };
    if (!game || !ARCADE_GAMES.includes(game as ArcadeGame)) {
      throw new Error("Unknown game.");
    }
    const nonce = randomUUID();
    const startedAt = Date.now();
    const token = signSession(game, context.userId, nonce, startedAt);
    return { token, startedAt };
  });

export type SubmitResult = {
  accepted: boolean;
  newBest: boolean;
  best: number;
  creditsAwarded: number;
  creditsEarnedToday: number;
  dailyCap: number;
  message: string;
};

/**
 * Submits a final score. Runs all anti-cheat guards, records the score, and
 * awards capped credits if it's a qualifying new personal best.
 */
export const submitArcadeScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<SubmitResult> => {
    const { userId } = context;
    const body = (data ?? {}) as { game?: string; score?: number; token?: string };
    const game = body.game as ArcadeGame;
    const score = Math.floor(Number(body.score ?? 0));
    const token = body.token ?? "";

    if (!game || !ARCADE_GAMES.includes(game)) throw new Error("Unknown game.");
    if (!Number.isFinite(score) || score < 0) throw new Error("Invalid score.");

    // Guard 2: signed session.
    const sess = verifySession(token, game, userId);
    if (!sess.ok || !sess.startedAt) {
      throw new Error("Invalid or missing game session. Please restart the game.");
    }
    const elapsedMs = Date.now() - sess.startedAt;
    if (elapsedMs > SESSION_MAX_AGE_MS) {
      throw new Error("That game session expired. Please play a fresh round.");
    }

    // Guard 3: plausibility.
    const cappedScore = Math.min(score, MAX_SCORE[game]);
    const elapsedSec = Math.max(SESSION_MIN_AGE_MS, elapsedMs) / 1000;
    const maxPlausible = Math.ceil(elapsedSec * MAX_SCORE_PER_SECOND[game]);
    const plausible = cappedScore <= maxPlausible && elapsedMs >= SESSION_MIN_AGE_MS;

    // Always record the score for the leaderboard (capped to the ceiling),
    // even if it won't earn credits.
    try {
      await supabaseAdmin.from("arcade_scores").insert({
        user_id: userId,
        game,
        score: cappedScore,
      });
    } catch {
      // non-fatal
    }

    const best = Math.max(await previousBest(userId, game), cappedScore);

    // Determine reward eligibility.
    const prevBest = await previousBestExcludingNow(userId, game, cappedScore);
    const improvement = cappedScore - prevBest;
    const isNewBest = cappedScore > prevBest;

    if (!plausible) {
      return {
        accepted: true,
        newBest: isNewBest,
        best,
        creditsAwarded: 0,
        creditsEarnedToday: await creditsEarnedToday(userId),
        dailyCap: ARCADE_DAILY_CAP,
        message: "Score saved to the leaderboard. (Too fast to qualify for credits.)",
      };
    }

    const earnedToday = await creditsEarnedToday(userId);
    const remaining = Math.max(0, ARCADE_DAILY_CAP - earnedToday);

    let creditsAwarded = 0;
    let message = "Score saved!";

    if (isNewBest && improvement >= MIN_IMPROVEMENT[game] && remaining > 0) {
      creditsAwarded = Math.min(REWARD_PER_IMPROVEMENT, remaining);
      // Ledger first (the cap depends on it), then grant.
      try {
        await supabaseAdmin.from("arcade_rewards").insert({
          user_id: userId,
          game,
          score: cappedScore,
          credits_awarded: creditsAwarded,
        });
        await supabaseAdmin.rpc("grant_credits_service", {
          _user_id: userId,
          _amount: creditsAwarded,
          _reason: `arcade:${game}`,
        });
        message = `New best! +${creditsAwarded} credit${creditsAwarded === 1 ? "" : "s"}.`;
      } catch {
        creditsAwarded = 0;
        message = "New best! (Couldn't award credits right now.)";
      }
    } else if (isNewBest && remaining === 0) {
      message = "New best! You've hit today's credit cap — come back tomorrow.";
    } else if (isNewBest) {
      message = `New best! Beat it by ${MIN_IMPROVEMENT[game]}+ to earn a credit.`;
    } else {
      message = "Score saved. Beat your best to earn credits.";
    }

    return {
      accepted: true,
      newBest: isNewBest,
      best,
      creditsAwarded,
      creditsEarnedToday: earnedToday + creditsAwarded,
      dailyCap: ARCADE_DAILY_CAP,
      message,
    };
  });

// Best score for this game EXCLUDING the row we just inserted, so we can
// compare the new score against the prior best. We approximate by taking the
// second-highest when the top equals the new score.
async function previousBestExcludingNow(userId: string, game: string, justScored: number): Promise<number> {
  const { data } = await supabaseAdmin
    .from("arcade_scores")
    .select("score")
    .eq("user_id", userId)
    .eq("game", game)
    .order("score", { ascending: false })
    .limit(2);
  const scores = (data ?? []).map((r: any) => r.score as number);
  if (scores.length === 0) return 0;
  // If the top score is the one we just inserted, the previous best is the
  // next one down (or 0 if there isn't one).
  if (scores[0] === justScored) return scores[1] ?? 0;
  return scores[0];
}

export type LeaderRow = { name: string; score: number; isMe: boolean };

/**
 * Top scores for a game, plus the caller's own best and today's reward status.
 */
export const getArcadeLeaderboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const game = (data as any)?.game as ArcadeGame;
    if (!game || !ARCADE_GAMES.includes(game)) throw new Error("Unknown game.");

    const { data: rows } = await supabaseAdmin
      .from("arcade_scores")
      .select("user_id, score, profiles(display_name)")
      .eq("game", game)
      .order("score", { ascending: false })
      .limit(50);

    // Collapse to best-per-user.
    const bestByUser = new Map<string, { name: string; score: number }>();
    for (const r of rows ?? []) {
      const uid = (r as any).user_id as string;
      const sc = (r as any).score as number;
      const nm = (r as any).profiles?.display_name ?? "Anonymous";
      const cur = bestByUser.get(uid);
      if (!cur || sc > cur.score) bestByUser.set(uid, { name: nm, score: sc });
    }
    const leaders: LeaderRow[] = [...bestByUser.entries()]
      .map(([uid, v]) => ({ name: v.name, score: v.score, isMe: uid === userId }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    const myBest = await previousBest(userId, game);
    const earnedToday = await creditsEarnedToday(userId);

    return {
      leaders,
      myBest,
      creditsEarnedToday: earnedToday,
      dailyCap: ARCADE_DAILY_CAP,
    };
  });
