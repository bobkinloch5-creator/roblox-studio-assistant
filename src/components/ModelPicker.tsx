import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Cpu, Check } from "lucide-react";
import { saveProjectAiSettings } from "@/lib/project-ai.functions";

type ProviderId = "openai" | "anthropic" | "google" | "groq" | "neokens";

const PROVIDER_LABELS: Record<ProviderId, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  groq: "Groq (free)",
  neokens: "Neokens",
};

const PROVIDER_MODELS: Record<ProviderId, string[]> = {
  openai: ["gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-5-codex", "gpt-4.1", "gpt-4.1-mini"],
  anthropic: ["claude-sonnet-4-5", "claude-opus-4-1", "claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"],
  google: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-3-flash-preview"],
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
  neokens: ["gemini-3-flash", "claude-haiku-4-5-20251001", "gpt-5.3-codex", "gemini-3.1-pro", "gpt-5.1"],
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
        <div className="absolute bottom-full mb-2 left-0 z-50 w-72 max-h-96 overflow-y-auto rounded-xl border border-border/60 bg-surface-elevated/95 backdrop-blur-xl shadow-2xl p-2">
          {(Object.keys(PROVIDER_LABELS) as ProviderId[]).map((p) => (
            <div key={p} className="mb-2">
              <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                {PROVIDER_LABELS[p]}
              </div>
              {PROVIDER_MODELS[p].map((m) => {
                const active = p === currentProvider && m === currentModel;
                return (
                  <button
                    key={`${p}:${m}`}
                    type="button"
                    disabled={saving}
                    onClick={() => pick(p, m)}
                    className={`w-full text-left flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs transition ${
                      active ? "bg-primary/15 text-foreground" : "hover:bg-surface/60 text-muted-foreground"
                    }`}
                  >
                    <span className="truncate">{m}</span>
                    {active && <Check className="h-3 w-3 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          ))}
          <div className="px-2 py-1 text-[10px] text-muted-foreground border-t border-border/40 mt-1">
            Groq & Neokens are free (admin keys). Others use your own key from AI Source.
          </div>
        </div>
      )}
    </div>
  );
}
