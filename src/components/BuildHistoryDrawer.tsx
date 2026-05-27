import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getBuildHistory, type BuildHistoryItem } from "@/lib/builds.functions";
import { History, X, FileCode, Zap, AlertTriangle, Loader2, CheckCircle2, Clock, Coins } from "lucide-react";

function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function BuildHistoryDrawer({
  projectId,
  open,
  onClose,
  onJumpToMessage,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onJumpToMessage?: (conversationId: string, messageId: string) => void;
}) {
  const load = useServerFn(getBuildHistory);
  const [items, setItems] = useState<BuildHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setErr(null);
    load({ data: { projectId, limit: 100 } })
      .then((res) => alive && setItems(res.items))
      .catch((e) => alive && setErr(e?.message ?? "Failed to load history"))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [open, projectId, load]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-background/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md h-full bg-surface border-l border-border shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="inline-flex items-center gap-2 text-sm font-semibold">
            <History className="h-4 w-4 text-primary-glow" /> Build History
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-elevated text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 py-2 text-[11px] text-muted-foreground border-b border-border">
          Every AI batch that produced files or Studio actions in this project.
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-xs">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading history…
            </div>
          )}
          {err && <div className="text-xs text-destructive">{err}</div>}
          {!loading && !err && items.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-10">
              No build history yet. Ask the AI to build something.
            </div>
          )}
          {items.map((it) => (
            <button
              key={it.id}
              onClick={() => onJumpToMessage?.(it.conversation_id, it.id)}
              className="w-full text-left rounded-lg border border-border bg-background/40 hover:bg-surface-elevated hover:border-primary/30 transition p-3 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {timeAgo(it.created_at)}
                </span>
                {it.reverted ? (
                  <span className="inline-flex items-center gap-1 text-amber-400">
                    <CheckCircle2 className="h-3 w-3" /> Reverted
                  </span>
                ) : (
                  <span className="text-muted-foreground truncate max-w-[60%]">
                    {it.conversation_title ?? "Chat"}
                  </span>
                )}
              </div>
              <div className="text-xs text-foreground line-clamp-2">
                {it.preview || "(no message)"}
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {it.files > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[10px] text-primary-glow">
                    <FileCode className="h-2.5 w-2.5" /> {it.files} file{it.files === 1 ? "" : "s"}
                  </span>
                )}
                {it.actions > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300">
                    <Zap className="h-2.5 w-2.5" /> {it.actions} op{it.actions === 1 ? "" : "s"}
                  </span>
                )}
                {it.dangerCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">
                    <AlertTriangle className="h-2.5 w-2.5" /> {it.dangerCount}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
