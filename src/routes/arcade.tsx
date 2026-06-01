import { createFileRoute } from "@tanstack/react-router";
import { Header, Footer } from "@/components/layout";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useCallback, useRef } from "react";
import { Gamepad2, Trophy, Coins, Loader2, Play, RotateCcw } from "lucide-react";
import {
  startArcadeSession,
  submitArcadeScore,
  getArcadeLeaderboard,
  ARCADE_GAMES,
  type ArcadeGame,
  type SubmitResult,
  type LeaderRow,
} from "@/lib/arcade.functions";
import { SpaceShooter } from "@/components/arcade/SpaceShooter";
import { BrickBreaker } from "@/components/arcade/BrickBreaker";
import { Snake } from "@/components/arcade/Snake";

export const Route = createFileRoute("/arcade")({
  component: ArcadePage,
  head: () => ({
    meta: [
      { title: "Arcade — Play & Earn Credits | BloxSmith" },
      {
        name: "description",
        content:
          "Play arcade mini-games on BloxSmith — space shooter, brick breaker, and snake — and earn a few credits each day by beating your best.",
      },
    ],
  }),
});

const GAME_META: Record<ArcadeGame, { name: string; tagline: string }> = {
  "space-shooter": { name: "Space Shooter", tagline: "Blast the descending fleet" },
  "brick-breaker": { name: "Brick Breaker", tagline: "Clear every brick" },
  snake: { name: "Snake", tagline: "Eat, grow, don't crash" },
};

function ArcadePage() {
  const startSession = useServerFn(startArcadeSession) as any;
  const submitScore = useServerFn(submitArcadeScore) as any;
  const fetchBoard = useServerFn(getArcadeLeaderboard) as any;

  const [game, setGame] = useState<ArcadeGame>("space-shooter");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [myBest, setMyBest] = useState(0);
  const [earnedToday, setEarnedToday] = useState(0);
  const [dailyCap, setDailyCap] = useState(2);
  const tokenRef = useRef<string | null>(null);

  const loadBoard = useCallback(
    (g: ArcadeGame) => {
      fetchBoard({ data: { game: g } })
        .then((r: any) => {
          setLeaders(r.leaders);
          setMyBest(r.myBest);
          setEarnedToday(r.creditsEarnedToday);
          setDailyCap(r.dailyCap);
        })
        .catch(() => {});
    },
    [fetchBoard],
  );

  useEffect(() => {
    loadBoard(game);
    setResult(null);
    setRunning(false);
  }, [game, loadBoard]);

  const handleStart = useCallback(async () => {
    setResult(null);
    try {
      const r = (await startSession({ data: { game } })) as { token: string };
      tokenRef.current = r.token;
    } catch {
      tokenRef.current = null;
    }
  }, [startSession, game]);

  const handleGameOver = useCallback(
    async (score: number) => {
      setRunning(false);
      if (!tokenRef.current) return;
      setSubmitting(true);
      try {
        const r = (await submitScore({
          data: { game, score, token: tokenRef.current },
        })) as SubmitResult;
        setResult(r);
        setEarnedToday(r.creditsEarnedToday);
        if (r.best > myBest) setMyBest(r.best);
        loadBoard(game);
      } catch (err) {
        setResult({
          accepted: false,
          newBest: false,
          best: myBest,
          creditsAwarded: 0,
          creditsEarnedToday: earnedToday,
          dailyCap,
          message: err instanceof Error ? err.message : "Could not submit score.",
        });
      } finally {
        setSubmitting(false);
        tokenRef.current = null;
      }
    },
    [submitScore, game, myBest, earnedToday, dailyCap, loadBoard],
  );

  const play = () => {
    setResult(null);
    setRunning(true);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-xl bg-primary/15 grid place-items-center">
            <Gamepad2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">Arcade</h1>
            <p className="text-sm text-muted-foreground">
              Play for fun and earn a few credits a day by beating your best.
            </p>
          </div>
        </div>

        {/* Daily cap meter */}
        <div className="mt-4 rounded-xl border border-border bg-surface-elevated/40 p-3 flex items-center gap-3">
          <Coins className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Credits earned today</span>
              <span className="font-mono">
                {earnedToday} / {dailyCap}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-background/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, (earnedToday / dailyCap) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Game tabs */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {ARCADE_GAMES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGame(g)}
              className={`rounded-xl border p-3 text-left transition ${
                game === g
                  ? "border-primary bg-primary/10"
                  : "border-border bg-surface-elevated/40 hover:border-primary/40"
              }`}
            >
              <div className="text-sm font-semibold">{GAME_META[g].name}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">
                {GAME_META[g].tagline}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
          {/* Game area */}
          <div className="rounded-2xl border border-border bg-surface-elevated/40 p-4">
            {!running && (
              <div className="flex flex-col items-center justify-center py-6">
                {result && (
                  <div className="mb-4 w-full max-w-sm rounded-xl border border-border bg-background/40 p-4 text-center">
                    <div className="text-lg font-bold">
                      {result.newBest ? "New personal best!" : "Game over"}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">{result.message}</div>
                    {result.creditsAwarded > 0 && (
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs text-primary font-semibold">
                        <Coins className="h-3.5 w-3.5" />+{result.creditsAwarded} credits
                      </div>
                    )}
                  </div>
                )}
                {submitting ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving score…
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={play}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition"
                  >
                    {result ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {result ? "Play again" : `Play ${GAME_META[game].name}`}
                  </button>
                )}
                <p className="text-[11px] text-muted-foreground mt-3">Your best: {myBest}</p>
              </div>
            )}

            {running && (
              <>
                {game === "space-shooter" && (
                  <SpaceShooter onStart={handleStart} onGameOver={handleGameOver} running={running} />
                )}
                {game === "brick-breaker" && (
                  <BrickBreaker onStart={handleStart} onGameOver={handleGameOver} running={running} />
                )}
                {game === "snake" && (
                  <Snake onStart={handleStart} onGameOver={handleGameOver} running={running} />
                )}
              </>
            )}
          </div>

          {/* Leaderboard */}
          <div className="rounded-2xl border border-border bg-surface-elevated/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Top players</h2>
            </div>
            {leaders.length === 0 ? (
              <p className="text-xs text-muted-foreground">No scores yet — be the first!</p>
            ) : (
              <ol className="space-y-1.5">
                {leaders.map((l, i) => (
                  <li
                    key={i}
                    className={`flex items-center justify-between text-xs rounded-md px-2 py-1.5 ${
                      l.isMe ? "bg-primary/10 text-foreground" : ""
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className="text-muted-foreground w-4 text-right">{i + 1}</span>
                      <span className="truncate">{l.name}</span>
                      {l.isMe && <span className="text-[9px] text-primary">(you)</span>}
                    </span>
                    <span className="font-mono">{l.score}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground mt-4 text-center">
          Credits are capped at {dailyCap} per day across all games. Earn by beating your previous best.
        </p>
      </main>
      <Footer />
    </div>
  );
}
