export type SiteProviderId = "groq" | "neokens";

export const SITE_PROVIDER_LABELS: Record<SiteProviderId, string> = {
  groq: "Groq (free)",
  neokens: "Neokens (free)",
};

export const SITE_PROVIDER_MODELS: Record<SiteProviderId, string[]> = {
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"],
  neokens: [
    "gpt-5.3-codex",
    "gpt-5.4",
    "gemini-3.1-pro",
    "gemini-3-flash",
    "claude-haiku-4-5-20251001",
    "gpt-5.1",
  ],
};

export const SITE_PROVIDER_DEFAULT_MODEL: Record<SiteProviderId, string> = {
  groq: "llama-3.3-70b-versatile",
  neokens: "gpt-5.3-codex",
};

export const SITE_MODEL_DESCRIPTIONS: Record<string, string> = {
  "gpt-5.3-codex": "Code specialist. Best for long Luau files, OOP classes, CFrame math, and raycast logic.",
  "gpt-5.4": "Strong reasoning for combat formulas, anti-exploit checks, ProfileService logic, and complex math.",
  "gemini-3.1-pro": "Best for huge Roblox systems: datastores, round loops, economies, and full-game architecture.",
  "gemini-3-flash": "Fast all-rounder for everyday Roblox scripting: GUIs, RemoteEvents, and small gameplay edits.",
  "claude-haiku-4-5-20251001": "Cheap and careful for cleaning messy Luau, refactoring scripts, and writing tidy ModuleScripts.",
  "gpt-5.1": "Balanced default for UI scripting, Tween animations, and ServerScriptService handlers.",
  "llama-3.3-70b-versatile": "Free Groq workhorse for Roblox scripts, gameplay loops, and normal chat help.",
  "llama-3.1-8b-instant": "Ultra-fast Groq option for tiny edits, quick snippets, and simple LocalScripts.",
  "gemma2-9b-it": "Small free Groq fallback for short answers, simple bug fixes, and lightweight Roblox help.",
};