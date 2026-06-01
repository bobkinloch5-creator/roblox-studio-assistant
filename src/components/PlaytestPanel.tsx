import { useState, useEffect, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bug, Loader2, Wand2, ShieldCheck, ChevronDown, ChevronRight, X } from "lucide-react";
import {
  getPlaytestErrors,
  clearPlaytestErrors,
  analyzeProject,
  buildErrorFixPrompt,
  type PlaytestError,
  type AnalysisFinding,
} from "@/lib/playtest.functions";

type Props = {
  projectId: string;
  busy: boolean;
  // Runs a prompt through the project's normal build flow (applies via plugin).
  onRunFix: (prompt: string) => void | Promise<void>;
};

const SEVERITY_STYLES: Record<AnalysisFinding["severity"], string> = {
  high: "border-destructive/40 bg-destructive/10 text-destructive",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-500",
  low: "border-border bg-background/40 text-muted-foreground",
};

export function PlaytestPanel({ projectId, busy, onRunFix }: Props) {
  const fetchErrors = useServerFn(getPlaytestErrors) as any;
  const clearErrors = useServerFn(clearPlaytestErrors) as any;
  const analyze = useServerFn(analyzeProject) as any;
  const buildFix = useServerFn(buildErrorFixPrompt) as any;

  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<PlaytestError[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [findings, setFindings] = useState<AnalysisFinding[] | null>(null);
  const [summary, setSummary] = useState<string>("");
  const [fixing, setFixing] = useState(false);

  const load = useCallback(() => {
    fetchErrors({ data: { projectId } })
      .then((r: any) => setErrors(r.errors as PlaytestError[]))
      .catch(() => {});
  }, [fetchErrors, projectId]);

  // Poll for new playtest errors while the panel is open (the plugin pushes
  // them as the user playtests in Studio).
  useEffect(() => {
    if (!open) return;
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [open, load]);

  async function runAnalysis() {
    setAnalyzing(true);
    setFindings(null);
    try {
      const r = (await analyze({ data: { projectId } })) as {
        findings: AnalysisFinding[];
        summary: string;
      };
      setFindings(r.findings);
      setSummary(r.summary);
    } catch (err) {
      setSummary(err instanceof Error ? err.message : "Analysis failed.");
      setFindings([]);
    } finally {
      setAnalyzing(false);
    }
  }

  async function fixErrors() {
    if (busy || fixing) return;
    setFixing(true);
    try {
      const r = (await buildFix({ data: { projectId } })) as { prompt: string; count: number };
      if (!r.prompt) return;
      await onRunFix(r.prompt);
      // Mark them resolved so they don't pile up; the fix run will surface any
      // that remain on the next playtest.
      await clearErrors({ data: { projectId } });
      setErrors([]);
    } catch {
      // swallow — the run itself surfaces errors in chat
    } finally {
      setFixing(false);
    }
  }

  const errorCount = errors.filter((e) => e.kind === "error").length;

  return (
    <div className="rounded-xl border border-border bg-surface-elevated/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-surface/40 transition"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <Bug className="h-4 w-4 text-primary" />
          Playtest
          {errors.length > 0 && (
            <span className="rounded-full bg-destructive/15 text-destructive text-[10px] px-1.5 py-0.5">
              {errors.length}
            </span>
          )}
        </span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
          {/* Pre-playtest analyzer */}
          <div>
            <button
              type="button"
              onClick={runAnalysis}
              disabled={analyzing}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-xs font-medium hover:border-primary/50 transition disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing scripts…
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3.5 w-3.5" /> Check for issues before playtesting
                </>
              )}
            </button>

            {findings !== null && (
              <div className="mt-2 space-y-1.5">
                <p className="text-[11px] text-muted-foreground">{summary}</p>
                {findings.length === 0 ? (
                  <p className="text-[11px] text-emerald-400">No obvious issues found. Looks good!</p>
                ) : (
                  findings.map((f, i) => (
                    <div key={i} className={`rounded-md border px-2.5 py-1.5 text-[11px] ${SEVERITY_STYLES[f.severity]}`}>
                      <div className="font-medium">
                        {f.severity.toUpperCase()}
                        {f.file ? ` · ${f.file}` : ""}
                      </div>
                      <div className="text-foreground/80 mt-0.5">{f.issue}</div>
                      <div className="opacity-80 mt-0.5">Fix: {f.fix}</div>
                    </div>
                  ))
                )}
                {findings.length > 0 && (
                  <button
                    type="button"
                    disabled={busy || fixing}
                    onClick={() =>
                      onRunFix(
                        "Fix the issues from the pre-playtest analysis. Here they are:\n" +
                          findings
                            .map((f, i) => `${i + 1}. (${f.severity}) ${f.file ?? ""}: ${f.issue} — ${f.fix}`)
                            .join("\n"),
                      )
                    }
                    className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition disabled:opacity-50"
                  >
                    <Wand2 className="h-3.5 w-3.5" /> Fix these with AI
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Captured playtest errors */}
          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-medium text-muted-foreground">
                Errors from your last playtest
              </span>
              {errors.length > 0 && (
                <button
                  type="button"
                  onClick={() => clearErrors({ data: { projectId } }).then(() => setErrors([]))}
                  className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
                >
                  <X className="h-3 w-3" /> Clear
                </button>
              )}
            </div>

            {errors.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Playtest your game in Studio. Any errors that appear will show up here, and I can fix them.
              </p>
            ) : (
              <>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {errors.map((e) => (
                    <div
                      key={e.id}
                      className={`rounded-md border px-2 py-1.5 text-[11px] font-mono break-words ${
                        e.kind === "error"
                          ? "border-destructive/30 bg-destructive/5 text-destructive"
                          : "border-amber-500/30 bg-amber-500/5 text-amber-500"
                      }`}
                    >
                      {e.message}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={busy || fixing}
                  onClick={fixErrors}
                  className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition disabled:opacity-50"
                >
                  {fixing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending to AI…
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-3.5 w-3.5" /> Fix {errorCount > 0 ? `${errorCount} error${errorCount === 1 ? "" : "s"}` : "these"} with AI
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
