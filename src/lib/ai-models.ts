export type SiteProviderId = "neokens";

export const SITE_PROVIDER_LABELS: Record<SiteProviderId, string> = {
  neokens: "Neokens (free)",
};

export const SITE_PROVIDER_MODELS: Record<SiteProviderId, string[]> = {
  neokens: [
    "claude-sonnet-4-6-thinking",
    "gpt-5.5",
    "gpt-5.3-codex",
    "gpt-5.4",
    "gemini-3.1-pro",
    "gemini-3-flash",
    "claude-haiku-4-5-20251001",
  ],
};

export const SITE_PROVIDER_DEFAULT_MODEL: Record<SiteProviderId, string> = {
  neokens: "gpt-5.5",
};

export const SITE_MODEL_DESCRIPTIONS: Record<string, string> = {
  "claude-sonnet-4-6-thinking":
    "Frontier reasoning with adaptive thinking. Best for full-game architecture, complex anti-exploit, and hard debugging where it should slow down and think first.",
  "gpt-5.5":
    "OpenAI's newest flagship — strongest at agentic coding, multi-step Roblox builds, and complex Luau refactors. Use for full games and ambitious systems.",
  "gpt-5.3-codex":
    "Code specialist. Best for long Luau files, OOP classes, CFrame math, and raycast logic.",
  "gpt-5.4":
    "Strong reasoning for combat formulas, anti-exploit checks, ProfileService logic, and complex math.",
  "gemini-3.1-pro":
    "Huge-context expert for sprawling Roblox systems: datastores, round loops, economies, and end-to-end game architecture across many files.",
  "gemini-3-flash":
    "Fast all-rounder for everyday Roblox scripting: GUIs, RemoteEvents, and small gameplay edits. Cheap and quick.",
  "claude-haiku-4-5-20251001":
    "Cheap and careful for cleaning messy Luau, refactoring scripts, and writing tidy ModuleScripts.",
};
