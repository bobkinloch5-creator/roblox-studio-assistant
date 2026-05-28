import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SITE_PROVIDER_MODELS, type SiteProviderId } from "./ai-models";

export type ModelTestResult = {
  provider: SiteProviderId;
  modelId: string;
  // Resolved underlying model name after virtual alias mapping (e.g.
  // "claude-sonnet-4-6-thinking" → "claude-sonnet-4-6").
  realModel: string;
  ok: boolean;
  durationMs: number;
  // Truncated assistant reply on success — useful for spot-checking that
  // the model is actually responding sensibly and not just echoing.
  sample?: string;
  // Error category on failure; helps tell "wrong model ID" from "rate
  // limited" from "credentials missing" at a glance.
  errorKind?: "not_configured" | "model_not_found" | "auth" | "rate_limit" | "timeout" | "provider" | "unknown";
  errorMessage?: string;
};

// Per-model wall-clock cap. The diagnostic isn't trying to stress-test —
// it just wants to know if the model responds at all. 15s is more than
// enough for a one-sentence prompt on every model we expose; anything
// slower than that is broken from a UX standpoint anyway.
const PER_MODEL_TIMEOUT_MS = 15_000;

const PING_PROMPT = 'Reply with the exact word "ok". No punctuation, no other words.';

function classifyError(err: any): { kind: ModelTestResult["errorKind"]; message: string } {
  const message = String(err?.message ?? err ?? "unknown error");
  const lower = message.toLowerCase();
  const status = err?.status ?? err?.statusCode;

  if (err?.name === "AbortError" || /abort|timeout|timed out/i.test(message)) {
    return { kind: "timeout", message };
  }
  if (status === 404 || /not found|does not exist|unknown model|invalid model|no such model/i.test(lower)) {
    return { kind: "model_not_found", message };
  }
  if (status === 401 || status === 403 || /unauthorized|forbidden|invalid.*api.*key|authentication/i.test(lower)) {
    return { kind: "auth", message };
  }
  if (status === 429 || /rate.?limit|too many requests/i.test(lower)) {
    return { kind: "rate_limit", message };
  }
  if (status === 502 || status === 503 || status === 504 || /bad gateway|service unavailable|provider/i.test(lower)) {
    return { kind: "provider", message };
  }
  return { kind: "unknown", message };
}

async function testOneModel(provider: SiteProviderId, modelId: string): Promise<ModelTestResult> {
  const started = Date.now();

  // Lazy imports so this server function doesn't pull AI SDKs into other
  // routes' bundles.
  const { generateText } = await import("ai");
  const { createProvider, resolveModelAlias } = await import("./ai-providers.server");
  const { createGroqProvider } = await import("./ai-gateway.server");

  // Resolve virtual aliases (e.g. "-thinking" suffixes) the same way the
  // real build path does. The test should hit the same model string that
  // production hits.
  const aliased = resolveModelAlias(modelId);

  let model: any;
  try {
    if (provider === "neokens") {
      const key = process.env.NEOKENS_API_KEY;
      if (!key) {
        return {
          provider, modelId, realModel: aliased.realModel,
          ok: false, durationMs: 0,
          errorKind: "not_configured",
          errorMessage: "NEOKENS_API_KEY env var not set on the server.",
        };
      }
      const gw = createProvider("neokens", key);
      model = gw(aliased.realModel);
    } else if (provider === "groq") {
      const key = process.env.GROQ_API_KEY;
      if (!key) {
        return {
          provider, modelId, realModel: aliased.realModel,
          ok: false, durationMs: 0,
          errorKind: "not_configured",
          errorMessage: "GROQ_API_KEY env var not set on the server.",
        };
      }
      const gw = createGroqProvider(key);
      model = gw(aliased.realModel);
    } else {
      return {
        provider, modelId, realModel: aliased.realModel,
        ok: false, durationMs: 0,
        errorKind: "unknown",
        errorMessage: `Unsupported provider for site test: ${provider}`,
      };
    }
  } catch (err) {
    const { kind, message } = classifyError(err);
    return {
      provider, modelId, realModel: aliased.realModel,
      ok: false, durationMs: Date.now() - started,
      errorKind: kind, errorMessage: message,
    };
  }

  try {
    const out = await generateText({
      model,
      prompt: PING_PROMPT,
      maxOutputTokens: 20,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(PER_MODEL_TIMEOUT_MS),
    });
    const sample = (out.text ?? "").trim().slice(0, 200);
    return {
      provider, modelId, realModel: aliased.realModel,
      ok: true, durationMs: Date.now() - started,
      sample: sample || "(empty response)",
    };
  } catch (err) {
    const { kind, message } = classifyError(err);
    return {
      provider, modelId, realModel: aliased.realModel,
      ok: false, durationMs: Date.now() - started,
      errorKind: kind, errorMessage: message.slice(0, 500),
    };
  }
}

/**
 * Admin-only diagnostic: pings every site-available model with a tiny
 * prompt and returns pass/fail status. Useful for verifying that newly
 * added models (e.g. virtual `-thinking` aliases) actually round-trip
 * to the underlying provider.
 *
 * Runs all tests in parallel so the page returns in roughly the time
 * of the single slowest model rather than the sum of all of them.
 */
export const testAllSiteModels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Gate to admins only. Pinging every model on every page hit would
    // be a meaningful cost vector otherwise.
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles ?? []).some(
      (r: { role: string }) => r.role === "admin" || r.role === "owner",
    );
    if (!isAdmin) {
      throw new Error("Forbidden — admin only.");
    }

    const jobs: Promise<ModelTestResult>[] = [];
    for (const provider of Object.keys(SITE_PROVIDER_MODELS) as SiteProviderId[]) {
      for (const modelId of SITE_PROVIDER_MODELS[provider]) {
        jobs.push(testOneModel(provider, modelId));
      }
    }
    const results = await Promise.all(jobs);

    const okCount = results.filter((r) => r.ok).length;
    return {
      ranAt: new Date().toISOString(),
      totalModels: results.length,
      okCount,
      failCount: results.length - okCount,
      results,
    };
  });
