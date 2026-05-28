import { useState, useRef, useEffect, type FormEvent } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "bloxsmith.helpchat.history";
const STORAGE_OPEN_KEY = "bloxsmith.helpchat.open";
const MAX_STORED_TURNS = 12;

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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Restore state on mount. Kept inside an effect (not lazy state init) so
  // we don't trip SSR hydration mismatches.
  useEffect(() => {
    setMessages(loadHistory());
    if (typeof localStorage !== "undefined") {
      setOpen(localStorage.getItem(STORAGE_OPEN_KEY) === "1");
    }
  }, []);

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

  function clearChat() {
    setMessages([]);
    setError(null);
    if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <>
      {/* Floating bubble — always visible bottom-right. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open help chat"
          className="fixed bottom-4 right-4 z-[60] h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 grid place-items-center hover:scale-105 transition-transform"
        >
          <MessageCircle className="h-5 w-5" />
        </button>
      )}

      {/* Panel. */}
      {open && (
        <aside
          className="fixed bottom-4 right-4 z-[60] w-[22rem] max-w-[calc(100vw-2rem)] h-[32rem] max-h-[calc(100vh-2rem)] rounded-2xl border border-border bg-surface-elevated/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden"
          role="dialog"
          aria-label="BloxSmith help chat"
        >
          <header className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-primary/15 grid place-items-center">
                <MessageCircle className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <div className="text-xs font-semibold leading-tight">Help</div>
                <div className="text-[10px] text-muted-foreground leading-tight">
                  Ask anything about BloxSmith
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clearChat}
                  className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-surface transition"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close help chat"
                className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface transition"
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
