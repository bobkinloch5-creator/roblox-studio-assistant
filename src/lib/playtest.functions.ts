import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PlaytestError = {
  id: string;
  message: string;
  kind: "error" | "warning";
  createdAt: string;
};

async function assertProjectAccess(supabase: any, projectId: string, userId: string) {
  const { data: project } = await supabase
    .from("projects")
    .select("id,user_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) throw new Error("Project not found.");
  if (project.user_id === userId) return;
  const { data: c } = await supabase
    .from("project_collaborators")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!c) throw new Error("You don't have access to this project.");
}

/**
 * Returns recent unresolved playtest errors captured by the plugin.
 */
export const getPlaytestErrors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { projectId } = (data ?? {}) as { projectId?: string };
    if (!projectId) throw new Error("Missing project.");
    await assertProjectAccess(supabase, projectId, userId);

    const { data: rows, error } = await supabase
      .from("playtest_errors")
      .select("id, message, kind, created_at")
      .eq("project_id", projectId)
      .eq("resolved", false)
      .order("created_at", { ascending: false })
      .limit(40);

    if (error) {
      if (/relation .*playtest_errors.* does not exist/i.test(error.message ?? "")) {
        return { errors: [] as PlaytestError[] };
      }
      throw new Error("Could not load playtest errors.");
    }

    // De-dupe identical messages, keeping the most recent.
    const seen = new Set<string>();
    const errors: PlaytestError[] = [];
    for (const r of rows ?? []) {
      if (seen.has(r.message)) continue;
      seen.add(r.message);
      errors.push({ id: r.id, message: r.message, kind: r.kind as any, createdAt: r.created_at });
    }
    return { errors };
  });

/**
 * Marks the project's captured playtest errors resolved (after a fix, or when
 * the user dismisses them).
 */
export const clearPlaytestErrors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { projectId } = (data ?? {}) as { projectId?: string };
    if (!projectId) throw new Error("Missing project.");
    await assertProjectAccess(supabase, projectId, userId);
    await supabase
      .from("playtest_errors")
      .update({ resolved: true })
      .eq("project_id", projectId)
      .eq("resolved", false);
    return { ok: true };
  });

export type AnalysisFinding = {
  severity: "high" | "medium" | "low";
  file: string | null;
  issue: string;
  fix: string;
};

/**
 * Pre-playtest static analysis. Reads the project's scripts and asks the AI to
 * flag likely runtime problems BEFORE the user playtests — missing event
 * handlers, wrong service placement, nil-index risks, unanchored parts, etc.
 */
export const analyzeProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ findings: AnalysisFinding[]; summary: string }> => {
    const { supabase, userId } = context;
    const { projectId } = (data ?? {}) as { projectId?: string };
    if (!projectId) throw new Error("Missing project.");
    await assertProjectAccess(supabase, projectId, userId);

    const { data: files } = await supabase
      .from("project_files")
      .select("path, content")
      .eq("project_id", projectId)
      .limit(60);

    const scripts = (files ?? []).filter((f: any) =>
      /\.(lua|luau)$/i.test(f.path ?? "") || /script/i.test(f.path ?? ""),
    );

    if (scripts.length === 0) {
      return { findings: [], summary: "No scripts found to analyze yet. Build something first!" };
    }

    // Cap the payload — concatenate scripts with a per-file budget so a huge
    // project doesn't blow the context window.
    let budget = 24000;
    const blocks: string[] = [];
    for (const f of scripts) {
      const content = String(f.content ?? "").slice(0, 4000);
      const block = `--- FILE: ${f.path} ---\n${content}`;
      if (budget - block.length < 0) break;
      budget -= block.length;
      blocks.push(block);
    }

    const { generateText } = await import("ai");
    const { resolveBuiltInGateway } = await import("./ai-providers.server");
    const model = resolveBuiltInGateway({ kind: "build", thinking: false }).model;

    const system = `You are a senior Roblox/Luau engineer doing a PRE-PLAYTEST review. Look at the scripts and find likely RUNTIME problems before the developer playtests: nil indexing, missing RemoteEvent/RemoteFunction handlers, scripts in the wrong service (e.g. server logic in StarterGui), :WaitForChild on things that never exist, infinite loops without wait, unanchored parts expected to stay put, deprecated API calls, and obvious logic errors.

Return STRICT JSON only (no markdown):
{"summary":"one-sentence overall health","findings":[{"severity":"high|medium|low","file":"path or null","issue":"what's wrong, concise","fix":"what to change, concise"}]}
List the most important issues first. If the scripts look healthy, return an empty findings array with an encouraging summary. Max 8 findings.`;

    let text = "";
    try {
      const out = await generateText({
        model,
        system,
        prompt: blocks.join("\n\n"),
        maxOutputTokens: 1800,
      });
      text = out.text ?? "";
    } catch (err) {
      throw new Error("Analysis failed: " + String((err as Error).message));
    }

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { findings: [], summary: "Analysis returned no structured result. Try again." };
    try {
      const parsed = JSON.parse(match[0]);
      const findings: AnalysisFinding[] = Array.isArray(parsed.findings)
        ? parsed.findings.slice(0, 8).map((f: any) => ({
            severity: ["high", "medium", "low"].includes(f.severity) ? f.severity : "medium",
            file: typeof f.file === "string" ? f.file : null,
            issue: String(f.issue ?? "").slice(0, 300),
            fix: String(f.fix ?? "").slice(0, 300),
          }))
        : [];
      return { findings, summary: String(parsed.summary ?? "Analysis complete.").slice(0, 200) };
    } catch {
      return { findings: [], summary: "Could not parse the analysis. Try again." };
    }
  });

/**
 * Builds a ready-to-run fix prompt from the captured playtest errors. The
 * client feeds this into the normal build/chat flow (which already applies
 * fixes through the plugin), so we reuse the entire existing apply pipeline
 * rather than duplicating it.
 */
export const buildErrorFixPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { projectId } = (data ?? {}) as { projectId?: string };
    if (!projectId) throw new Error("Missing project.");
    await assertProjectAccess(supabase, projectId, userId);

    const { data: rows } = await supabase
      .from("playtest_errors")
      .select("message, kind")
      .eq("project_id", projectId)
      .eq("resolved", false)
      .order("created_at", { ascending: false })
      .limit(20);

    const errs = rows ?? [];
    if (errs.length === 0) {
      return { prompt: "", count: 0 };
    }

    const list = errs
      .map((e: any, i: number) => `${i + 1}. [${e.kind}] ${e.message}`)
      .join("\n");

    const prompt = `My last playtest produced these runtime errors and warnings. Find the root cause in my scripts and fix them. Don't just suppress the errors — fix the underlying bug. Here are the captured messages:\n\n${list}`;

    return { prompt, count: errs.length };
  });
