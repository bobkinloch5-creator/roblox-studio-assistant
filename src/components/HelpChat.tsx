import { useState, useRef, useEffect, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "bloxsmith.helpchat.history";
const STORAGE_OPEN_KEY = "bloxsmith.helpchat.open";
const STORAGE_POS_KEY = "bloxsmith.helpchat.pos";
const MAX_STORED_TURNS = 12;

// Approximate bubble/panel sizes used for off-screen clamping. The actual
// elements are sized by CSS so these are just safe lower bounds — the
// clamp keeps at least this much of the widget on-screen at all times.
const BUBBLE_SIZE = 56;
const PANEL_WIDTH = 352;
const PANEL_HEIGHT = 512;
const EDGE_PAD = 16;

type Pos = { left: number; top: number };

function loadPos(): Pos | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_POS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.left === "number" && typeof parsed?.top === "number") {
      return { left: parsed.left, top: parsed.top };
    }
  } catch {
    // ignore — return null and we'll fall back to default
  }
  return null;
}

function savePos(pos: Pos) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_POS_KEY, JSON.stringify(pos));
  } catch {
    // ignore quota
  }
}

// Default position: bottom-right with a generous gap so the bubble is
// clearly visible rather than tucked into the corner.
function defaultPos(open: boolean): Pos {
  if (typeof window === "undefined") {
    return { left: 1000, top: 600 }; // SSR placeholder — never visible
  }
  const w = open ? PANEL_WIDTH : BUBBLE_SIZE;
  const h = open ? PANEL_HEIGHT : BUBBLE_SIZE;
  return {
    left: Math.max(EDGE_PAD, window.innerWidth - w - EDGE_PAD),
    top: Math.max(EDGE_PAD, window.innerHeight - h - EDGE_PAD),
  };
}

function clampPos(pos: Pos, open: boolean): Pos {
  if (typeof window === "undefined") return pos;
  const w = open ? PANEL_WIDTH : BUBBLE_SIZE;
  const h = open ? PANEL_HEIGHT : BUBBLE_SIZE;
  return {
    left: Math.min(Math.max(EDGE_PAD, pos.left), window.innerWidth - w - EDGE_PAD),
    top: Math.min(Math.max(EDGE_PAD, pos.top), window.innerHeight - h - EDGE_PAD),
  };
}

function loadHistory(): Message[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-MAX_STORED_TURNS);
  } catch {
    return [];
  }
}

function saveHistory(history: Message[]) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-MAX_STORED_TURNS)));
  } catch {
    // ignore quota errors — history isn't critical
  }
}

const SUGGESTED = [
  "What is BloxSmith?",
  "How much do credits cost?",
  "How do I install the plugin?",
  "Does this work with Claude or Cursor?",
];

export function HelpChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Position is null until mount so server-rendered HTML matches the
  // client's first render (which also doesn't know the viewport size).
  const [pos, setPos] = useState<Pos | null>(null);
  const [dragging, setDragging] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Track whether the current pointerdown turned into a real drag (vs a
  // click). Set during pointermove; checked during pointerup to decide
  // whether the click should toggle open/closed.
  const dragMovedRef = useRef(false);
  // Where the pointer was relative to the widget's top-left when the
  // drag started. Lets us follow the pointer without snapping the
  // widget's origin to the cursor.
  const dragOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  // Restore state on mount. Kept inside an effect (not lazy state init) so
  // we don't trip SSR hydration mismatches.
  useEffect(() => {
    setMessages(loadHistory());
    const openStored = typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_OPEN_KEY) === "1";
    setOpen(openStored);
    const stored = loadPos();
    setPos(clampPos(stored ?? defaultPos(openStored), openStored));
  }, []);

  // Persist position whenever it changes (but not the initial null).
  useEffect(() => {
    if (pos) savePos(pos);
  }, [pos]);

  // Re-clamp when the window resizes — otherwise the widget can end up
  // hanging off-screen if the user shrinks their window.
  useEffect(() => {
    if (!pos) return;
    const onResize = () => setPos((p) => (p ? clampPos(p, open) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pos, open]);

  // Re-clamp when toggling open/closed since the panel is much larger
  // than the bubble. A position that fit the bubble may push the panel
  // off the right edge.
  useEffect(() => {
    if (!pos) return;
    setPos((p) => (p ? clampPos(p, open) : p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_OPEN_KEY, open ? "1" : "0");
  }, [open]);

  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  // Auto-scroll to bottom on new message.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  // Focus the input when the panel opens.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [open]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setError(null);
    setInput("");
    const next: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setSending(true);
    try {
      const res = await fetch("/api/public/help-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          // Send the prior history (not the just-added user message — the
          // server appends that itself from the `message` field).
          history: messages.slice(-8),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data?.message === "string"
            ? data.message
            : "Sorry — I couldn't answer that. Please try again.";
        setError(msg);
        return;
      }
      const reply = typeof data?.reply === "string" ? data.reply : "";
      if (!reply) {
        setError("No reply received — please try again.");
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setError("Network error — please check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    send(input);
  }

  // Drag handler. Returns the pointerdown listener wired up so that a
  // tap (under a few px of movement) is still treated as a click, but
  // anything bigger captures the pointer and follows it until release.
  function clearChat() {
    setMessages([]);
    setError(null);
    if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
  }

  // Drag handler. Returns the pointerdown listener wired up so that a
  // tap (under a few px of movement) is still treated as a click, but
  // anything bigger captures the pointer and follows it until release.
  function startDrag(e: ReactPointerEvent<HTMLElement>) {
    if (!pos) return;
    // Right-click / middle-click shouldn't drag.
    if (e.button !== 0) return;
    // Form controls inside the widget (input, textarea) must not be
    // hijacked into a drag — let normal interaction work.
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, button:not([data-helpchat-handle])")) return;

    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    dragOffsetRef.current = {
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
    };
    dragMovedRef.current = false;

    // pointerId capture means we keep getting moves even if the cursor
    // leaves the element (e.g. moves fast across the page).
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Some browsers refuse capture on synthetic events — ignore.
    }

    const startX = e.clientX;
    const startY = e.clientY;

    const onMove = (ev: PointerEvent) => {
      const moved = Math.hypot(ev.clientX - startX, ev.clientY - startY);
      if (moved > 4 && !dragMovedRef.current) {
        dragMovedRef.current = true;
        setDragging(true);
      }
      if (dragMovedRef.current) {
        const nextLeft = ev.clientX - dragOffsetRef.current.dx;
        const nextTop = ev.clientY - dragOffsetRef.current.dy;
        setPos(clampPos({ left: nextLeft, top: nextTop }, open));
      }
    };

    const onUp = () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      // Defer clearing dragging so the click handler that fires right
      // after pointerup can read it and suppress the open/close toggle.
      const wasDrag = dragMovedRef.current;
      setTimeout(() => {
        setDragging(false);
        dragMovedRef.current = false;
      }, 0);
      // Suppress the next click if it was a drag.
      if (wasDrag) {
        const suppress = (clickEv: Event) => {
          clickEv.stopPropagation();
          clickEv.preventDefault();
          el.removeEventListener("click", suppress, true);
        };
        el.addEventListener("click", suppress, true);
      }
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  }

  // Render nothing until position is initialized — avoids a one-frame
  // flash at the wrong location and prevents SSR hydration mismatches.
  if (!pos) return null;

  const cursorClass = dragging ? "cursor-grabbing" : "cursor-grab";

  return (
    <>
      {/* Floating bubble — draggable. Positioned inline so the user can
          move it anywhere; persists across page loads via localStorage. */}
      {!open && (
        <div
          className="fixed z-[60] flex items-center gap-2"
          style={{ left: pos.left, top: pos.top, touchAction: "none" }}
          onPointerDown={startDrag}
        >
          <button
            type="button"
            data-helpchat-handle
            onClick={() => {
              // Suppress the toggle if the pointer-up just ended a drag.
              if (dragMovedRef.current) return;
              setOpen(true);
            }}
            aria-label="Open help chat"
            className={`h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-2xl shadow-primary/40 grid place-items-center hover:scale-105 transition-transform ring-2 ring-primary/30 ring-offset-2 ring-offset-background ${cursorClass}`}
          >
            <MessageCircle className="h-6 w-6" />
          </button>
          {/* "Need help?" pill — visible until the user has chatted at
              least once. Helps people notice the bubble exists. */}
          {messages.length === 0 && (
            <span
              className="hidden sm:inline-flex items-center rounded-full bg-surface-elevated/95 border border-border px-3 py-1.5 text-xs font-medium shadow-lg pointer-events-none select-none"
            >
              Need help?
            </span>
          )}
        </div>
      )}

      {/* Panel — draggable via the header. */}
      {open && (
        <aside
          className="fixed z-[60] w-[22rem] max-w-[calc(100vw-2rem)] h-[32rem] max-h-[calc(100vh-2rem)] rounded-2xl border border-border bg-surface-elevated/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden"
          style={{ left: pos.left, top: pos.top }}
          role="dialog"
          aria-label="BloxSmith help chat"
        >
          <header
            className={`flex items-center justify-between border-b border-border px-3 py-2.5 select-none ${cursorClass}`}
            style={{ touchAction: "none" }}
            onPointerDown={startDrag}
          >
            <div className="flex items-center gap-2 pointer-events-none">
              <div className="h-7 w-7 rounded-full bg-primary/15 grid place-items-center">
                <MessageCircle className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <div className="text-xs font-semibold leading-tight">Help</div>
                <div className="text-[10px] text-muted-foreground leading-tight">
                  Drag to move · ask anything about BloxSmith
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clearChat}
                  className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-surface transition cursor-pointer"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close help chat"
                className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5"
          >
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Hi! I'm the BloxSmith help bot. I can answer questions about credits,
                  the Roblox Studio plugin, MCP, or how the site works. What do you
                  want to know?
                </p>
                <div className="space-y-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Try asking
                  </div>
                  {SUGGESTED.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="w-full text-left rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5 text-xs hover:border-primary/50 hover:bg-surface transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background/60 border border-border text-foreground"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="rounded-xl border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Thinking…
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive">
                {error}
              </div>
            )}
          </div>

          <form
            onSubmit={onSubmit}
            className="border-t border-border p-2 flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              disabled={sending}
              maxLength={1500}
              className="flex-1 rounded-md border border-border bg-background/60 px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary/50 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send message"
              className="h-7 w-7 grid place-items-center rounded-md bg-primary text-primary-foreground disabled:opacity-40 hover:opacity-90 transition"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </aside>
      )}
    </>
  );
}
