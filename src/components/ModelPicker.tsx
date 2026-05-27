import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Cpu, Check } from "lucide-react";
import { saveProjectAiSettings } from "@/lib/project-ai.functions";

type ProviderId = "groq" | "neokens";

const PROVIDER_LABELS: Record<ProviderId, string> = {
  groq: "Groq (free)",
  neokens: "Neokens (free)",
};

const PROVIDER_MODELS: Record<ProviderId, string[]> = {
  groq: [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "meta-llama/llama-4-maverick-17b-128e-instruct",
    "qwen/qwen3-32b",
    "moonshotai/kimi-k2-instruct",
    "deepseek-r1-distill-llama-70b",
  ],
  neokens: [
    "gemini-3.1-pro",
    "gemini-3-flash",
    "claude-haiku-4-5-20251001",
    "gpt-5.4",
    "gpt-5.3-codex",
    "gpt-5.1",
  ],
};

const MODEL_DESCRIPTIONS: Record<string, string> = {
  // Neokens — Roblox-focused tips
  "gemini-3.1-pro": "Best for huge games — designs full Luau systems, datastores, and round-based gameplay end-to-end.",
  "gemini-3-flash": "Fast all-rounder for everyday Roblox scripting — quick part spawners, GUI tweaks, RemoteEvent wiring.",
  "claude-haiku-4-5-20251001": "Cheap + careful. Great for refactoring messy Luau scripts and writing clean ModuleScripts.",
  "gpt-5.4": "Strong reasoning — combat formulas, anti-exploit checks, ProfileService logic, complex math.",
  "gpt-5.3-codex": "Code specialist. Best for long Luau files, OOP classes, and tricky CFrame / raycast logic.",
  "gpt-5.1": "Balanced default. Good UI scripting, Tween animations, and ServerScriptService handlers.",
  // Groq
  "llama-3.3-70b-versatile": "Fast & free heavy model. Solid for simple Roblox scripts and gameplay loops.",
  "llama-3.1-8b-instant": "Ultra-fast. Use for tiny edits or LocalScript snippets — not big systems.",
  "openai/gpt-oss-120b": "Open GPT, large. Decent for Luau gameplay code when speed matters more than nuance.",
  "openai/gpt-oss-20b": "Lighter open GPT — quick utility scripts and bug fixes.",
  "meta-llama/llama-4-scout-17b-16e-instruct": "Fast Llama 4 — handy for spawning models, NPCs, and instance trees.",
  "meta-llama/llama-4-maverick-17b-128e-instruct": "Bigger Llama 4 — better at multi-script Roblox systems.",
  "qwen/qwen3-32b": "Strong reasoning at zero cost — datastores, leaderboard logic, save systems.",
  "moonshotai/kimi-k2-instruct": "Long-context — paste in a whole place file and ask for refactors.",
  "deepseek-r1-distill-llama-70b": "Reasoning model — math-heavy gameplay (ballistics, physics, damage curves).",
};


export function ModelPicker({
  projectId,
  provider,
  model,
  onChange,
}: {
  projectId: string;
  provider: ProviderId | null;
  model: string | null;
  onChange: (provider: ProviderId, model: string) => void;
}) {
  const save = useServerFn(saveProjectAiSettings);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const currentProvider: ProviderId = provider ?? "groq";
  const currentModel = model ?? PROVIDER_MODELS[currentProvider][0];

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const pick = async (p: ProviderId, m: string) => {
    setSaving(true);
    try {
      await save({ data: { projectId, mode: "api_key", provider: p, model: m } });
      onChange(p, m);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const shortModel = currentModel.length > 22 ? currentModel.slice(0, 22) + "…" : currentModel;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full bg-surface-elevated/60 border border-border/40 px-2.5 py-0.5 text-[10px] hover:border-primary/60 transition"
        title="Choose AI provider and model"
      >
        <Cpu className="h-3 w-3 text-primary" />
        <span className="text-muted-foreground">
          {PROVIDER_LABELS[currentProvider]} · {shortModel}
        </span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute bottom-full mb-2 left-0 z-50 w-[22rem] max-h-[28rem] overflow-y-auto rounded-xl border border-border/60 bg-surface-elevated/95 backdrop-blur-xl shadow-2xl p-2">
          {(Object.keys(PROVIDER_LABELS) as ProviderId[]).map((p) => (
            <div key={p} className="mb-2">
              <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                {PROVIDER_LABELS[p]}
              </div>
              {PROVIDER_MODELS[p].map((m) => {
                const active = p === currentProvider && m === currentModel;
                const desc = MODEL_DESCRIPTIONS[m];
                return (
                  <button
                    key={`${p}:${m}`}
                    type="button"
                    disabled={saving}
                    onClick={() => pick(p, m)}
                    className={`w-full text-left rounded-md px-2 py-1.5 transition ${
                      active ? "bg-primary/15 text-foreground" : "hover:bg-surface/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`truncate text-xs font-medium ${active ? "text-foreground" : "text-foreground/90"}`}>
                        {m}
                      </span>
                      {active && <Check className="h-3 w-3 text-primary shrink-0" />}
                    </div>
                    {desc && (
                      <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                        {desc}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          <div className="px-2 py-1 text-[10px] text-muted-foreground border-t border-border/40 mt-1">
            Groq & Neokens are free (admin keys). Pick by what you're building in Roblox.
          </div>
        </div>
      )}
    </div>
  );
}
