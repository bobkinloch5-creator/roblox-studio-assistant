import { createFileRoute, redirect } from "@tanstack/react-router";
import { Header, Footer } from "@/components/layout";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, PlayCircle, RefreshCw } from "lucide-react";
import { requireAdmin } from "@/lib/admin.functions";
import { testAllSiteModels, type ModelTestResult } from "@/lib/model-test.functions";

export const Route = createFileRoute("/admin/model-test")({
  beforeLoad: async () => {
    try {
      await requireAdmin();
    } catch {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: ModelTestPage,
  head: () => ({
    meta: [
      { title: "Model Diagnostics — BloxSmith Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type TestRun = {
  ranAt: string;
  totalModels: number;
  okCount: number;
  failCount: number;
  results: ModelTestResult[];
};

const ERROR_LABELS: Record<NonNullable<ModelTestResult["errorKind"]>, string> = {
  not_configured: "Not configured",
  model_not_found: "Model not found",
  auth: "Auth failed",
  rate_limit: "Rate limited",
  timeout: "Timeout",
  provider: "Provider error",
  unknown: "Unknown error",
};

function ModelTestPage() {
  const runTest = useServerFn(testAllSiteModels);
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<TestRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setRunning(true);
    setError(null);
    try {
      const result = await runTest({ data: {} });
      setRun(result as TestRun);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Model Diagnostics</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Pings every site-available model with a one-word prompt to verify it responds.
              Admin-only.
            </p>
          </div>
          <button
            type="button"
            onClick={go}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition disabled:opacity-50"
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Testing…
              </>
            ) : run ? (
              <>
                <RefreshCw className="h-4 w-4" />
                Run again
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4" />
                Run test
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive mb-6">
            {error}
          </div>
        )}

        {!run && !running && (
          <div className="rounded-xl border border-border bg-surface-elevated/40 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Click <strong>Run test</strong> to ping every model. Each model gets up to 15 seconds.
              All models test in parallel, so the whole run usually finishes in well under 30 seconds.
            </p>
          </div>
        )}

        {running && !run && (
          <div className="rounded-xl border border-border bg-surface-elevated/40 p-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3 text-primary" />
            <p className="text-sm text-muted-foreground">
              Pinging every model in parallel… results in &lt;30s.
            </p>
          </div>
        )}

        {run && (
          <>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <SummaryCard label="Total" value={String(run.totalModels)} tone="neutral" />
              <SummaryCard label="Working" value={String(run.okCount)} tone="ok" />
              <SummaryCard
                label="Failing"
                value={String(run.failCount)}
                tone={run.failCount > 0 ? "fail" : "neutral"}
              />
            </div>

            <div className="text-[11px] text-muted-foreground mb-2">
              Ran at {new Date(run.ranAt).toLocaleString()}
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface-elevated/60 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Status</th>
                    <th className="text-left px-3 py-2 font-semibold">Provider</th>
                    <th className="text-left px-3 py-2 font-semibold">Model ID</th>
                    <th className="text-right px-3 py-2 font-semibold">Time</th>
                    <th className="text-left px-3 py-2 font-semibold">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {run.results.map((r) => (
                    <ResultRow key={`${r.provider}:${r.modelId}`} r={r} />
                  ))}
                </tbody>
              </table>
            </div>

            {run.failCount > 0 && (
              <div className="mt-6 rounded-lg border border-border bg-background/40 p-4 text-xs text-muted-foreground space-y-1.5">
                <div className="font-semibold text-foreground mb-1">How to read the errors</div>
                <div><strong>Model not found</strong> — the provider doesn't accept that exact model string. Check the spelling or remove the alias.</div>
                <div><strong>Auth failed</strong> — the API key for that provider is missing or invalid.</div>
                <div><strong>Not configured</strong> — the env var (e.g. <code>NEOKENS_API_KEY</code>) isn't set on the server.</div>
                <div><strong>Rate limited</strong> — temporary; rerun the test in a minute.</div>
                <div><strong>Timeout</strong> — the model didn't respond within 15s. Usually a provider-side issue.</div>
                <div><strong>Provider error</strong> — 5xx from upstream. Usually temporary.</div>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "fail" | "neutral";
}) {
  const toneClass =
    tone === "ok"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
      : tone === "fail"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-border bg-surface-elevated/40 text-foreground";
  return (
    <div className={`rounded-lg border px-4 py-3 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-2xl font-bold mt-0.5">{value}</div>
    </div>
  );
}

function ResultRow({ r }: { r: ModelTestResult }) {
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2">
        {r.ok ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        ) : (
          <XCircle className="h-4 w-4 text-destructive" />
        )}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{r.provider}</td>
      <td className="px-3 py-2 font-mono text-xs">
        <div>{r.modelId}</div>
        {r.realModel !== r.modelId && (
          <div className="text-[10px] text-muted-foreground mt-0.5">
            → {r.realModel}
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-right text-xs text-muted-foreground tabular-nums">
        {r.durationMs > 0 ? `${(r.durationMs / 1000).toFixed(1)}s` : "—"}
      </td>
      <td className="px-3 py-2 text-xs">
        {r.ok ? (
          <span className="text-muted-foreground">
            <span className="text-emerald-400">replied:</span>{" "}
            <span className="font-mono">{r.sample}</span>
          </span>
        ) : (
          <div>
            <span className="font-semibold text-destructive">
              {r.errorKind ? ERROR_LABELS[r.errorKind] : "Failed"}
            </span>
            {r.errorMessage && (
              <div className="text-[10px] text-muted-foreground mt-0.5 break-all">
                {r.errorMessage}
              </div>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
