import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getBuildHistory, revertBuild, type BuildHistoryItem } from "@/lib/builds.functions";
import { toast } from "sonner";
import {
  History,
  X,
  FileCode,
  Zap,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Clock,
  Coins,
  Undo2,
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
} from "lucide-react";

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
  const revert = useServerFn(revertBuild);
  const [items, setItems] = useState<BuildHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [revertingId, setRevertingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setErr(null);
    load({ data: { projectId, limit: 100 } })
      .then((res) => alive && setItems(res.items))
      .catch((e) => alive && setErr(e?.message ?? "Failed to load history"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [open, projectId, load]);

  const handleRevert = async (it: BuildHistoryItem) => {
    if (it.reverted || it.snapshotCount === 0) return;
    if (
      !confirm(
        `Revert this build?\n\n${it.snapshotCount} file change${
          it.snapshotCount === 1 ? "" : "s"
        } will be undone. New files are deleted and old contents are restored. Studio will sync the deletes next.`,
      )
    )
      return;
    setRevertingId(it.id);
    try {
      const res = await revert({ data: { projectId, messageId: it.id } });
      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, reverted: true } : x)));
      toast.success(
        `Reverted — restored ${res.restored}, removed ${res.removed}${
          res.queuedDeletes ? `, queued ${res.queuedDeletes} Studio delete${res.queuedDeletes === 1 ? "" : "s"}` : ""
        }.`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Revert failed");
    } finally {
      setRevertingId(null);
    }
  };

  const lastUndoable = items.find((it) => !it.reverted && it.snapshotCount > 0);

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

        {lastUndoable && (
          <div className="px-3 py-2 border-b border-border bg-amber-500/5">
            <button
              onClick={() => handleRevert(lastUndoable)}
              disabled={revertingId === lastUndoable.id}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 px-3 py-1.5 text-xs font-medium text-amber-300 transition disabled:opacity-50"
              title="Undo the most recent AI build"
            >
              {revertingId === lastUndoable.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Undo2 className="h-3.5 w-3.5" />
              )}
              Undo last build ({lastUndoable.snapshotCount} file{lastUndoable.snapshotCount === 1 ? "" : "s"})
            </button>
          </div>
        )}

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
          {items.map((it) => {
            const isOpen = expanded[it.id] === true;
            const canRevert = !it.reverted && it.snapshotCount > 0;
            return (
              <div
                key={it.id}
                className="rounded-lg border border-border bg-background/40 hover:border-primary/30 transition"
              >
                <button
                  onClick={() => onJumpToMessage?.(it.conversation_id, it.id)}
                  className="w-full text-left p-3 space-y-1.5 hover:bg-surface-elevated/50 rounded-t-lg"
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
                  <div className="text-xs text-foreground line-clamp-2">{it.preview || "(no message)"}</div>
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
                    {it.creditsUsed != null && it.creditsUsed > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 text-[10px] text-yellow-300">
                        <Coins className="h-2.5 w-2.5" /> {it.creditsUsed} cr
                      </span>
                    )}
                  </div>
                </button>

                {it.snapshotCount > 0 && (
                  <div className="border-t border-border/60 px-3 py-1.5 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setExpanded((p) => ({ ...p, [it.id]: !isOpen }))}
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition"
                    >
                      {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      View changes ({it.snapshotCount})
                    </button>
                    {canRevert && (
                      <button
                        onClick={() => handleRevert(it)}
                        disabled={revertingId === it.id}
                        className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 text-[11px] text-amber-300 transition disabled:opacity-50"
                        title="Revert this build"
                      >
                        {revertingId === it.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Undo2 className="h-3 w-3" />
                        )}
                        Revert
                      </button>
                    )}
                  </div>
                )}

                {isOpen && it.snapshotPaths.length > 0 && (
                  <div className="px-3 pb-3 pt-1 space-y-1 border-t border-border/40">
                    {it.snapshotPaths.map((s, i) => (
                      <div
                        key={`${s.path}-${i}`}
                        className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground"
                      >
                        {s.existed ? (
                          <Pencil className="h-3 w-3 text-amber-400 shrink-0" />
                        ) : (
                          <Plus className="h-3 w-3 text-emerald-400 shrink-0" />
                        )}
                        <span className="truncate" title={s.path}>
                          {s.path}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
