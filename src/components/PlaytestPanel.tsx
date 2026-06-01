import { useState, useRef, useEffect, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Gamepad2,
  Loader2,
  X,
  ScanSearch,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Undo2,
  Sparkles,
  ListChecks,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  startPlaytestScan,
  approvePlaytestPlan,
  getPlaytestRun,
  verifyPlaytestRun,
  rollbackPlaytestRun,
} from "@/lib/playtest.functions";

type Severity = "error" | "warning" | "info";
type Finding = { id: string; severity: Severity; kind: string; title: string; detail: string; target: string };
type PlanStep = { id: string; title: string; detail: string; target: string; actionType: string };
type Run = {
  id: string;
  status: string;
  request: string;
  findings: Finding[];
  plan: { summary: string; steps: PlanStep[] };
  verification?: { resolved: boolean; remaining: Finding[] };
  summary?: string | null;
};

type Phase = "idle" | "scanning" | "review" | "applying" | "verifying" | "done";

const EXAMPLES = [
  "Fix my shop",
  "Make my coins save",
  "Why is my UI broken?",
  "Fix the errors in my game",
  "Help me improve this game",
];

function sevDot(s: Severity) {
  return s === "error"
    ? "bg-destructive"
    : s === "warning"
      ? "bg-amber-400"
      : "bg-sky-400";
}

export function PlaytestPanel({
  projectId,
  studioConnected,
  onClose,
}: {
  projectId: string;
  studioConnected: boolean;
  onClose: () => void;
}) {
  const scan = useServerFn(startPlaytestScan);
  const approve = useServerFn(approvePlaytestPlan);
  const poll = useServerFn(getPlaytestRun);
  const verify = useServerFn(verifyPlaytestRun);
  const rollback = useServerFn(rollbackPlaytestRun);

  const [request, setRequest] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [run, setRun] = useState<Run | null>(null);
  const [statusLine, setStatusLine] = useState("");
  const [progress, setProgress] = useState({ applied: 0, total: 0, failed: 0 });
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollTimer.current) clearInterval(pollTimer.current); }, []);

  const startScan = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setPhase("scanning");
    setStatusLine("Reading your project and scanning for problems…");
    try {
      const res: any = await scan({ data: { projectId, request } });
      const r: Run = res.run;
      setRun(r);
      setApproved(new Set((r.plan?.steps ?? []).map((s) => s.id)));
      setPhase("review");
      setStatusLine(
        r.findings.length
          ? `Found ${r.findings.length} issue(s). Review the plan below.`
          : "No obvious problems found in this scan.",
      );
    } catch (e: any) {
      setPhase("idle");
      toast.error(e?.message || "Scan failed.");
    } finally {
      setBusy(false);
    }
  }, [busy, projectId, request, scan]);

  const beginPolling = useCallback(
    (runId: string) => {
      if (pollTimer.current) clearInterval(pollTimer.current);
      pollTimer.current = setInterval(async () => {
        try {
          const res: any = await poll({ data: { runId } });
          setProgress(res.progress);
          if (res.progress.total > 0 && res.progress.applied >= res.progress.total) {
            if (pollTimer.current) clearInterval(pollTimer.current);
            setPhase("verifying");
            setStatusLine("Changes applied in Studio. Re-scanning to confirm…");
            const v: any = await verify({ data: { runId } });
            setRun(v.run);
            setPhase("done");
            setStatusLine(v.run.summary || "Done.");
          }
        } catch {
          /* keep polling */
        }
      }, 2500);
    },
    [poll, verify],
  );

  const applyFix = useCallback(async () => {
    if (!run || busy) return;
    if (!studioConnected) {
      toast.warning("Open the BloxSmith plugin in Roblox Studio so changes can be applied there.");
    }
    setBusy(true);
    setPhase("applying");
    setStatusLine("Sending approved fixes to your Roblox Studio plugin…");
    try {
      const res: any = await approve({
        data: { runId: run.id, approvedStepIds: Array.from(approved) },
      });
      setRun(res.run);
      setProgress({ applied: 0, total: res.queued ?? 0, failed: 0 });
      setStatusLine("Applying changes in Studio… watch them appear.");
      beginPolling(run.id);
    } catch (e: any) {
      setPhase("review");
      toast.error(e?.message || "Couldn't apply the fix.");
    } finally {
      setBusy(false);
    }
  }, [run, busy, studioConnected, approve, approved, beginPolling]);

  const doRollback = useCallback(async () => {
    if (!run || busy) return;
    setBusy(true);
    setStatusLine("Reverting the last fix in Studio…");
    try {
      const res: any = await rollback({ data: { runId: run.id } });
      setRun(res.run);
      toast.success(`Reverted ${res.reverted} change(s). Undo also works with Ctrl+Z in Studio.`);
      setStatusLine("Rolled back. Your project is back to how it was before this fix.");
    } catch (e: any) {
      toast.error(e?.message || "Rollback failed.");
    } finally {
      setBusy(false);
    }
  }, [run, busy, rollback]);

  const toggleStep = (id: string) =>
    setApproved((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const pct =
    progress.total > 0 ? Math.min(100, Math.round((progress.applied / progress.total) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="flex w-full sm:max-w-lg flex-col max-h-[90vh] overflow-hidden rounded-t-2xl sm:rounded-2xl border border-border/60 bg-surface-elevated/95 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/15 text-primary">
              <Gamepad2 className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-semibold text-foreground">Playtest with AI</div>
              <div className="text-[11px] text-muted-foreground">
                {studioConnected ? (
                  <span className="text-emerald-500">Studio connected</span>
                ) : (
                  <span className="text-amber-500">Open the BloxSmith plugin in Studio</span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-surface/60 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {/* Request input */}
          {(phase === "idle" || phase === "scanning") && (
            <>
              <p className="text-xs text-muted-foreground">
                Tell BloxSmith what to fix in plain words. It scans your game, finds problems,
                shows a plan, and only changes things after you approve.
              </p>
              <textarea
                value={request}
                onChange={(e) => setRequest(e.target.value.slice(0, 500))}
                placeholder="e.g. Fix my shop, make my coins save, why is my UI broken?"
                rows={2}
                disabled={phase === "scanning"}
                className="w-full resize-none rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none disabled:opacity-60"
              />
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    disabled={phase === "scanning"}
                    onClick={() => setRequest(ex)}
                    className="rounded-full border border-border/50 bg-background/30 px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/50 hover:text-foreground transition disabled:opacity-50"
                  >
                    {ex}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={startScan}
                disabled={phase === "scanning"}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition disabled:opacity-60"
              >
                {phase === "scanning" ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Scanning your game…</>
                ) : (
                  <><ScanSearch className="h-4 w-4" /> Playtest with AI</>
                )}
              </button>
            </>
          )}

          {/* Live status line */}
          {statusLine && phase !== "idle" && (
            <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/30 px-3 py-2 text-xs text-muted-foreground">
              {(phase === "scanning" || phase === "applying" || phase === "verifying") && (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
              )}
              <span>{statusLine}</span>
            </div>
          )}

          {/* Findings */}
          {run && run.findings.length > 0 && phase !== "scanning" && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5" /> What I found
              </div>
              {run.findings.map((f) => (
                <div key={f.id} className="rounded-lg border border-border/40 bg-background/30 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${sevDot(f.severity)}`} />
                    <span className="text-xs font-medium text-foreground">{f.title}</span>
                  </div>
                  <p className="mt-1 pl-4 text-[11px] leading-relaxed text-muted-foreground">{f.detail}</p>
                  <p className="mt-0.5 pl-4 text-[10px] text-muted-foreground/70">→ {f.target}</p>
                </div>
              ))}
            </div>
          )}

          {/* Plan (review + approve) */}
          {run && phase === "review" && run.plan?.steps?.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <ListChecks className="h-3.5 w-3.5" /> Plan — approve before any change
              </div>
              <p className="text-[11px] text-muted-foreground">{run.plan.summary}</p>
              {run.plan.steps.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/40 bg-background/30 px-3 py-2 hover:border-primary/40"
                >
                  <input
                    type="checkbox"
                    checked={approved.has(s.id)}
                    onChange={() => toggleStep(s.id)}
                    className="mt-0.5 accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-foreground">{s.title}</span>
                    <span className="block text-[11px] text-muted-foreground">{s.detail}</span>
                    <span className="mt-0.5 inline-block rounded bg-primary/10 px-1.5 py-px text-[10px] text-primary">
                      {s.actionType} · {s.target || "Studio"}
                    </span>
                  </span>
                </label>
              ))}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={applyFix}
                  disabled={busy || approved.size === 0}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition disabled:opacity-50"
                >
                  <Wrench className="h-4 w-4" /> Apply Fix ({approved.size})
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-border/50 px-3 py-2 text-sm text-muted-foreground hover:bg-surface/60"
                >
                  Not now
                </button>
              </div>
            </div>
          )}

          {/* Apply progress */}
          {(phase === "applying" || phase === "verifying") && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Applying in Studio</span>
                <span className="tabular-nums">{progress.applied}/{progress.total}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-background/50">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {progress.failed > 0 && (
                <p className="text-[11px] text-destructive">{progress.failed} action(s) reported an error.</p>
              )}
            </div>
          )}

          {/* Done + verify result */}
          {phase === "done" && run && (
            <div className="space-y-2">
              <div
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                  run.verification?.resolved
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-500"
                }`}
              >
                {run.verification?.resolved ? (
                  <ShieldCheck className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                <span className="text-xs font-medium">{run.summary}</span>
              </div>

              {run.verification && !run.verification.resolved && run.verification.remaining?.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Still needs attention
                  </div>
                  {run.verification.remaining.map((f) => (
                    <div key={f.id} className="rounded-lg border border-border/40 bg-background/30 px-3 py-2 text-[11px] text-muted-foreground">
                      {f.title} <span className="text-muted-foreground/60">→ {f.target}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                {!run.verification?.resolved && (
                  <button
                    type="button"
                    onClick={() => { setPhase("idle"); setRun(null); setRequest(""); }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                  >
                    <Sparkles className="h-4 w-4" /> Fix the next problem
                  </button>
                )}
                <button
                  type="button"
                  onClick={doRollback}
                  disabled={busy}
                  className="flex items-center justify-center gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm text-muted-foreground hover:bg-surface/60 disabled:opacity-50"
                >
                  <Undo2 className="h-4 w-4" /> Undo this fix
                </button>
              </div>
              <button
                type="button"
                onClick={() => { setPhase("idle"); setRun(null); setRequest(""); }}
                className="w-full rounded-lg border border-border/40 px-3 py-1.5 text-xs text-muted-foreground hover:bg-surface/60"
              >
                New playtest
              </button>
            </div>
          )}
        </div>

        {/* Footer note — safety + how-to */}
        <div className="border-t border-border/40 px-4 py-2 text-[10px] leading-relaxed text-muted-foreground/70">
          Playtest AI only works inside your own Roblox Studio project through the official BloxSmith
          plugin. Press Play (F5) in Studio to run the scene after fixes — the plugin can't start
          Play for you. Changes are reversible with Undo or Ctrl+Z.
        </div>
      </div>
    </div>
  );
}
