import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  BLOXSMITH_MODEL,
  BLOXSMITH_THINK_MODEL,
  BLOXSMITH_FAST_MODEL,
  BLOXSMITH_LARGE_MODEL,
  createGroqProvider,
} from "./ai-gateway.server";
import { SITE_PROVIDER_DEFAULT_MODEL, SITE_PROVIDER_MODELS } from "./ai-models";

export type ProviderId = "openai" | "anthropic" | "google" | "groq" | "neokens";
export type ModelKind = "chat" | "build" | "fast" | "large";

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google Gemini",
  groq: "Groq",
  neokens: "Neokens (multi-model)",
};

// Curated model lists per provider. Keep the lists short — only models that
// reliably handle Lua/Luau and tool calling.
export const PROVIDER_MODELS: Record<ProviderId, string[]> = {
  openai: ["gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-5-codex", "gpt-4.1", "gpt-4.1-mini"],
  anthropic: [
    "claude-sonnet-4-5",
    "claude-opus-4-1",
    "claude-3-5-sonnet-latest",
    "claude-3-5-haiku-latest",
  ],
  google: [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-3-flash-preview",
  ],
  groq: [
    ...SITE_PROVIDER_MODELS.groq,
  ],
  // Neokens proxies many models behind a single key — see neokens.com/docs.
  // Curated to cheaper models only (no Opus 4.7 / Sonnet 4.6 thinking).
  neokens: [
    ...SITE_PROVIDER_MODELS.neokens,
  ],

};

export const PROVIDER_DEFAULT_MODEL: Record<ProviderId, string> = {
  openai: "gpt-5-mini",
  anthropic: "claude-sonnet-4-5",
  google: "gemini-2.5-flash",
  groq: SITE_PROVIDER_DEFAULT_MODEL.groq,
  neokens: SITE_PROVIDER_DEFAULT_MODEL.neokens,
};

const NEOKENS_MODEL_BY_KIND: Record<ModelKind, string> = {
  chat: "gpt-5.3-codex",
  build: "gpt-5.3-codex",
  fast: "gpt-5.3-codex",
  large: "gpt-5.3-codex",
};

const sanitizingFetch: typeof fetch = async (input, init) => {
  if (init?.body && typeof init.body === "string") {
    try {
      const parsed = JSON.parse(init.body);
      if (Array.isArray(parsed?.messages)) {
        parsed.messages = parsed.messages.map((m: any) => {
          if (!m || typeof m !== "object") return m;
          const { reasoning_content, reasoning, ...rest } = m;
          return rest;
        });
        init = { ...init, body: JSON.stringify(parsed) };
      }
    } catch {
      // Leave non-JSON request bodies untouched.
    }
  }
  return fetch(input as any, init);
};

function providerEndpoint(provider: ProviderId): { name: string; baseURL: string } {
  switch (provider) {
    case "openai":
      return { name: "openai", baseURL: "https://api.openai.com/v1" };
    case "groq":
      return { name: "groq", baseURL: "https://api.groq.com/openai/v1" };
    // Anthropic and Google both expose OpenAI-compatible endpoints
    case "anthropic":
      return { name: "anthropic", baseURL: "https://api.anthropic.com/v1" };
    case "google":
      return {
        name: "google",
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      };
    case "neokens":
      // Neokens credits gateway — OpenAI-compatible, one key for many models.
      return { name: "neokens", baseURL: "https://api.quatarly.cloud/v1" };
  }
}

export function createProvider(provider: ProviderId, apiKey: string) {
  const { name, baseURL } = providerEndpoint(provider);
  return createOpenAICompatible({
    name,
    baseURL,
    apiKey,
    fetch: sanitizingFetch,
  });
}

export type ResolvedGateway = {
  source: "mcp" | "api_key";
  provider: ProviderId;
  modelName: string;
  // The vercel AI SDK model handle to pass into generateText / streamText.
  model: ReturnType<ReturnType<typeof createOpenAICompatible>>;
};

export function resolveBuiltInGateway(opts: { kind: ModelKind; thinking?: boolean }): ResolvedGateway {
  const neokensKey = process.env.NEOKENS_API_KEY;
  if (neokensKey) {
    const modelName = NEOKENS_MODEL_BY_KIND[opts.kind] ?? SITE_PROVIDER_DEFAULT_MODEL.neokens;
    const gw = createProvider("neokens", neokensKey);
    return { source: "mcp", provider: "neokens", modelName, model: gw(modelName) };
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error("AI gateway not configured — NEOKENS_API_KEY or GROQ_API_KEY missing.");
  const gw = createGroqProvider(groqKey);
  const modelName =
    opts.kind === "large"
      ? BLOXSMITH_LARGE_MODEL
      : opts.kind === "fast"
        ? BLOXSMITH_FAST_MODEL
        : opts.thinking
          ? BLOXSMITH_THINK_MODEL
          : BLOXSMITH_MODEL;
  return { source: "mcp", provider: "groq", modelName, model: gw(modelName) };
}

/**
 * Resolves which AI gateway + model to use for a given user + project.
 *
 * - If the project has `mode = 'api_key'` and the user has a stored key for
 *   the chosen provider, use that.
 * - Otherwise fall back to the built-in Groq path (current default).
 *
 * The fallback is deliberate: if a user toggles to API-key mode but hasn't
 * pasted a key yet, we don't want their next chat to hard-fail.
 */
export async function resolveAiGateway(opts: {
  userId: string;
  projectId: string | null | undefined;
  kind: ModelKind;
  thinking?: boolean;
}): Promise<ResolvedGateway> {
  const fallback = (): ResolvedGateway => resolveBuiltInGateway(opts);

  if (!opts.projectId) return fallback();

  const { data: settings } = await supabaseAdmin
    .from("project_ai_settings")
    .select("mode,provider,model")
    .eq("project_id", opts.projectId)
    .maybeSingle();

  if (!settings || settings.mode !== "api_key" || !settings.provider) {
    return fallback();
  }

  const provider = settings.provider as ProviderId;
  const modelName = settings.model || PROVIDER_DEFAULT_MODEL[provider];

  // Neokens & Groq are site-wide gateways — use env keys, no per-user key.
  if (provider === "neokens") {
    const neoKey = process.env.NEOKENS_API_KEY;
    if (!neoKey) return fallback();
    const gw = createProvider("neokens", neoKey);
    return { source: "api_key", provider, modelName, model: gw(modelName) };
  }
  if (provider === "groq") {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) return fallback();
    const gw = createGroqProvider(groqKey);
    return { source: "api_key", provider, modelName, model: gw(modelName) };
  }

  const { data: keyRow } = await supabaseAdmin
    .from("user_provider_keys")
    .select("api_key")
    .eq("user_id", opts.userId)
    .eq("provider", provider)
    .maybeSingle();

  if (!keyRow?.api_key) {
    // User toggled to API-key mode but never pasted a key — fall back gracefully.
    return fallback();
  }

  const gw = createProvider(provider, keyRow.api_key);

  return {
    source: "api_key",
    provider,
    modelName,
    model: gw(modelName),
  };
}
