export type SiteProviderId = "groq" | "neokens" | "cometapi";

export const SITE_PROVIDER_LABELS: Record<SiteProviderId, string> = {
  groq: "Groq (free)",
  neokens: "Neokens (free)",
  cometapi: "CometAPI (premium)",
};

export const SITE_PROVIDER_MODELS: Record<SiteProviderId, string[]> = {
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"],
  neokens: [
    // Claude Sonnet 4.6/4.7 "thinking" variants were removed after the
    // model diagnostic returned Bad Gateway from Neokens twice in a row.
    // Their proxy cannot reach those underlying Anthropic models. Add
    // them back if/when Neokens supports them.
    "gpt-5.5",
    "gpt-5.3-codex",
    "gpt-5.4",
    "gemini-3.1-pro",
    "gemini-3-flash",
    "claude-haiku-4-5-20251001",
    "gpt-5.1",
  ],
  // CometAPI model IDs use the bare slug (e.g. "claude-opus-4-8"), per
  // their OpenAI-compatible chat endpoint. Curated to text models that
  // handle Luau + tool calls well. Long-context picks (DeepSeek V4 1M,
  // Grok 4.20 2M) are first since they directly serve large documents
  // and long conversations without losing context. Verify each with the
  // admin Model Diagnostics tool after deploying — CometAPI's catalog
  // shifts and not every slug is guaranteed live.
  cometapi: [
    "claude-opus-4-8",
    "claude-sonnet-4-6",
    "gpt-5.5",
    "gemini-3.5-flash",
    "gemini-3.1-pro-preview",
    "grok-4-3",
    "grok-4-2",
    "deepseek-v4",
    "deepseek-v4-flash",
    "qwen3-7-max",
    "qwen3-6-plus",
    "kimi-k2-6",
    "glm-5-1",
  ],
};

export const SITE_PROVIDER_DEFAULT_MODEL: Record<SiteProviderId, string> = {
  groq: "llama-3.3-70b-versatile",
  neokens: "gpt-5.5",
  cometapi: "claude-sonnet-4-6",
};

export const SITE_MODEL_DESCRIPTIONS: Record<string, string> = {
  // CometAPI text models
  "claude-opus-4-8": "Most intelligent model — best for the hardest full-game architecture, complex anti-exploit, and deep multi-step debugging. Premium.",
  "gemini-3.5-flash": "Fast and smart with strong factual grounding. Great everyday driver for most Roblox scripting at low cost.",
  "gemini-3.1-pro-preview": "Multimodal reasoning over huge inputs — full code repos, long design docs, mixed media. Use for sprawling projects.",
  "grok-4-3": "Strong agentic reasoning and tool use at a low price. Good all-round build model.",
  "grok-4-2": "2M-token context. Best when you need to feed in a very large codebase or long conversation without losing track.",
  "deepseek-v4": "1M-token context, top-tier reasoning and coding at a low price. Excellent for long documents and big multi-file builds.",
  "deepseek-v4-flash": "1M-token context, efficiency-tuned. Fast and cheap for long-context work where you don't need the full Pro model.",
  "qwen3-7-max": "Agentic coding specialist — front-end prototyping through complex multi-file engineering. Reliable across long tasks.",
  "qwen3-6-plus": "Strong code development and fast multimodal reasoning at a low price. Great everyday coding model for Vibe-style iteration.",
  "kimi-k2-6": "Long, stable code generation with good instruction-following and self-correction. Supports thinking and non-thinking modes.",
  "glm-5-1": "Built for long-horizon autonomous tasks — keeps goal alignment over very long builds without drifting.",
  "gpt-5.5": "OpenAI's newest flagship — strongest at agentic coding, multi-step Roblox builds, and complex Luau refactors. Use for full games and ambitious systems.",
  "gpt-5.3-codex": "Code specialist. Best for long Luau files, OOP classes, CFrame math, and raycast logic.",
  "gpt-5.4": "Strong reasoning for combat formulas, anti-exploit checks, ProfileService logic, and complex math.",
  "gemini-3.1-pro": "Huge-context expert for sprawling Roblox systems: datastores, round loops, economies, and end-to-end game architecture across many files.",
  "gemini-3-flash": "Fast all-rounder for everyday Roblox scripting: GUIs, RemoteEvents, and small gameplay edits. Cheap and quick.",
  "claude-haiku-4-5-20251001": "Cheap and careful for cleaning messy Luau, refactoring scripts, and writing tidy ModuleScripts.",
  "gpt-5.1": "Balanced workhorse for UI scripting, Tween animations, and standard ServerScriptService handlers.",
  "llama-3.3-70b-versatile": "Free Groq workhorse — solid for Roblox scripts, gameplay loops, and normal chat help. No API key needed.",
  "llama-3.1-8b-instant": "Ultra-fast free Groq option for tiny edits, quick snippets, and simple LocalScripts.",
  "gemma2-9b-it": "Small free Groq fallback for short answers, simple bug fixes, and lightweight Roblox help.",
};