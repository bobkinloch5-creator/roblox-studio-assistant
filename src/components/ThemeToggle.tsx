import { useTheme, THEMES, type Theme, type ThemeCategory } from "@/hooks/useTheme";
import { Palette, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const CATEGORIES: ThemeCategory[] = ["Base", "Roblox Games", "Seasonal"];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const active = THEMES.find((t) => t.id === theme);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    if (open) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 min-w-[7.75rem] items-center gap-2 rounded-xl border border-border/70 bg-surface/85 px-3 shadow-[var(--shadow-card)] transition hover:bg-surface-elevated/95"
        aria-label="Change theme"
        title={`Theme: ${active?.label ?? theme}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[12px] leading-none">
          {active?.emoji}
        </span>
        <Palette className="h-3.5 w-3.5 text-primary-glow" />
        <span className="hidden truncate text-[12px] font-medium text-foreground/90 lg:inline">
          {active?.label}
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-3 max-h-[28rem] w-[19rem] overflow-y-auto rounded-2xl border border-border/70 bg-surface-elevated/95 shadow-2xl backdrop-blur-xl animate-fade-in">
            {CATEGORIES.map((cat) => (
              <div key={cat}>
                <div className="sticky top-0 z-10 border-b border-border/40 bg-surface-elevated/95 px-4 py-2 backdrop-blur-xl">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    {cat}
                  </p>
                </div>
                <div className="py-1.5">
                  {THEMES.filter((t) => t.category === cat).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { setTheme(t.id as Theme); setOpen(false); }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-background/35"
                      role="menuitemradio"
                      aria-checked={theme === t.id}
                    >
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/8 text-base shadow-[inset_0_1px_0_oklch(1_0_0_/_0.1)]">
                        {t.emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.95rem] font-medium text-foreground">{t.label}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{t.hint}</span>
                      </span>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                        {theme === t.id && <Check className="h-4 w-4 text-primary-glow" />}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
