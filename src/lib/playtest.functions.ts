import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PLAYTEST_SCAN_COST = 1;
const PLAYTEST_FIX_COST = 2;

async function assertOwnsProject(userId: string, projectId: string) {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("id,user_id")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.user_id !== userId) throw new Error("Project not found.");
}

/**
 * Phase 1 — SCAN + PLAN.
 * Reads the latest synced project files + captured Studio errors, runs the
 * heuristic scanners, asks the AI to interpret the user's request and produce a
 * plan, and stores a `playtest_runs` row in status 'planned' awaiting approval.
 * No Studio changes happen here.
 */
export const startPlaytestScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ projectId: z.string().uuid(), request: z.string().max(500).default("") }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertOwnsProject(userId, data.projectId);

    // Charge the small scan cost (owners pay 0 inside spend_credits_atomic).
    const { error: spendErr } = await supabase.rpc("spend_credits_atomic", {
      _amount: PLAYTEST_SCAN_COST,
    });
    if (spendErr) {
      if (/insufficient/i.test(spendErr.message))
        throw new Error("Not enough credits to run a Playtest scan.");
      throw new Error(spendErr.message);
    }

    const { runHeuristics, synthesizePlan } = await import("./playtest-diagnose.server");

    const [{ data: files }, { data: errs }] = await Promise.all([
      supabaseAdmin
        .from("project_files")
        .select("path,file_type,service_location,content")
        .eq("project_id", data.projectId),
      supabaseAdmin
        .from("studio_errors")
        .select("file_path,error_message")
        .eq("project_id", data.projectId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const fileList = (files ?? []) as any[];
    const findings = runHeuristics(fileList, (errs ?? []) as any[]);
    const plan = await synthesizePlan({
      request: data.request,
      findings,
      fileIndex: fileList.map((f) => ({ path: f.path, file_type: f.file_type })),
    });

    const { data: run, error } = await supabase
      .from("playtest_runs")
      .insert({
        user_id: userId,
        project_id: data.projectId,
        request: data.request,
        status: "planned",
        findings,
        plan,
        credits_spent: PLAYTEST_SCAN_COST,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    return { run };
  });

/**
 * Phase 2 — APPROVE + APPLY.
 * Turns approved plan steps into plugin_actions, snapshots the prior content of
 * any files the fix will touch (for rollback), charges the fix cost, and moves
 * the run to 'applying'. The Studio plugin's existing poll loop delivers them.
 */
export const approvePlaytestPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        runId: z.string().uuid(),
        // Step ids the user approved; defaults to all steps in the plan.
        approvedStepIds: z.array(z.string()).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };

    const { data: run, error: runErr } = await supabase
      .from("playtest_runs")
      .select("*")
      .eq("id", data.runId)
      .single();
    if (runErr || !run) throw new Error("Playtest run not found.");
    if (run.user_id !== userId) throw new Error("Not your run.");
    if (run.status !== "planned")
      throw new Error(`This run is '${run.status}', not awaiting approval.`);

    const allSteps = (run.plan?.steps ?? []) as any[];
    const steps =
      data.approvedStepIds && data.approvedStepIds.length
        ? allSteps.filter((s) => data.approvedStepIds!.includes(s.id))
        : allSteps;
    if (steps.length === 0) throw new Error("No steps approved.");

    // Build concrete plugin actions from the approved steps.
    const { buildActionsForSteps } = await import("./playtest-diagnose.server");
    const { data: files } = await supabaseAdmin
      .from("project_files")
      .select("path,file_type,service_location,content")
      .eq("project_id", run.project_id);
    const actions = await buildActionsForSteps({
      request: run.request,
      steps,
      files: (files ?? []) as any[],
    });
    if (actions.length === 0)
      throw new Error("Couldn't turn the plan into Studio actions. Try rephrasing your request.");

    // Snapshot prior content of any file paths these actions touch, for rollback.
    const touched = new Set<string>();
    for (const a of actions as any[]) {
      const p = a.path || a.target || a.name;
      if (typeof p === "string" && p) touched.add(p);
    }
    let rollback: Array<{ path: string; prior_content: string | null; existed: boolean }> = [];
    if (touched.size > 0) {
      const { data: existing } = await supabaseAdmin
        .from("project_files")
        .select("path,content")
        .eq("project_id", run.project_id)
        .in("path", Array.from(touched));
      const map = new Map((existing ?? []).map((f: any) => [f.path, f.content]));
      rollback = Array.from(touched).map((p) => ({
        path: p,
        prior_content: map.has(p) ? (map.get(p) as string) : null,
        existed: map.has(p),
      }));
    }

    // Charge the fix cost.
    const { error: spendErr } = await supabase.rpc("spend_credits_atomic", {
      _amount: PLAYTEST_FIX_COST,
    });
    if (spendErr) {
      if (/insufficient/i.test(spendErr.message))
        throw new Error("Not enough credits to apply the fix.");
      throw new Error(spendErr.message);
    }

    // Queue actions for the plugin. A final 'playtest_ready' frames the scene.
    const rows = (actions as any[]).map((a) => ({
      project_id: run.project_id,
      user_id: userId,
      action_type: a.type,
      payload: a,
      status: "pending" as const,
    }));
    rows.push({
      project_id: run.project_id,
      user_id: userId,
      action_type: "playtest_ready",
      payload: {
        type: "playtest_ready",
        focus: (actions as any[]).find((a) => a.path || a.target)?.path,
        note: "BloxSmith Playtest AI applied your approved fixes.",
        checklist: steps.map((s: any) => s.title).slice(0, 6),
      } as any,
      status: "pending" as const,
    });

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("plugin_actions")
      .insert(rows)
      .select("id,action_type");
    if (insErr) throw new Error("Failed to queue Studio actions: " + insErr.message);

    const { data: updated, error: updErr } = await supabase
      .from("playtest_runs")
      .update({
        status: "applying",
        applied_actions: inserted,
        rollback_snapshot: rollback,
        credits_spent: (run.credits_spent ?? 0) + PLAYTEST_FIX_COST,
        updated_at: new Date().toISOString(),
      })
      .eq("id", run.id)
      .select("*")
      .single();
    if (updErr) throw new Error(updErr.message);

    return { run: updated, queued: inserted?.length ?? 0 };
  });

/**
 * Poll a run's status. The client uses this to drive the live panel and to know
 * when the queued actions have all executed (so it can trigger a verify scan).
 */
export const getPlaytestRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ runId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: run, error } = await supabase
      .from("playtest_runs")
      .select("*")
      .eq("id", data.runId)
      .single();
    if (error || !run) throw new Error("Playtest run not found.");
    if (run.user_id !== userId) throw new Error("Not your run.");

    // Report how many of the queued actions have executed.
    let applied = 0;
    let total = 0;
    let failed = 0;
    const ids = (run.applied_actions ?? []).map((a: any) => a.id).filter(Boolean);
    if (ids.length) {
      const { data: acts } = await supabaseAdmin
        .from("plugin_actions")
        .select("status")
        .in("id", ids);
      total = acts?.length ?? 0;
      applied = (acts ?? []).filter((a: any) => a.status === "executed").length;
      failed = (acts ?? []).filter((a: any) => a.status === "error").length;
    }
    return { run, progress: { applied, total, failed } };
  });

/**
 * Phase 3 — VERIFY (re-scan). Re-runs heuristics against the now-updated files
 * and records whether the originally-found issues are resolved.
 */
export const verifyPlaytestRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ runId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: run, error: runErr } = await supabase
      .from("playtest_runs")
      .select("*")
      .eq("id", data.runId)
      .single();
    if (runErr || !run) throw new Error("Playtest run not found.");
    if (run.user_id !== userId) throw new Error("Not your run.");

    const { runHeuristics } = await import("./playtest-diagnose.server");
    const [{ data: files }, { data: errs }] = await Promise.all([
      supabaseAdmin
        .from("project_files")
        .select("path,file_type,service_location,content")
        .eq("project_id", run.project_id),
      supabaseAdmin
        .from("studio_errors")
        .select("file_path,error_message")
        .eq("project_id", run.project_id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    const remaining = runHeuristics((files ?? []) as any[], (errs ?? []) as any[]);

    // Consider the run resolved if the originally-flagged targets are now clean.
    const before = new Set((run.findings ?? []).map((f: any) => `${f.kind}:${f.target}`));
    const stillBad = remaining.filter((f) => before.has(`${f.kind}:${f.target}`));
    const resolved = stillBad.length === 0;

    const summary = resolved
      ? `Fixed ${(run.findings ?? []).length} issue(s). Re-scan is clean for the items we targeted.`
      : `Applied fixes; ${stillBad.length} item(s) still need attention.`;

    const { data: updated, error: updErr } = await supabase
      .from("playtest_runs")
      .update({
        status: "done",
        verification: { resolved, remaining: stillBad },
        summary,
        updated_at: new Date().toISOString(),
      })
      .eq("id", run.id)
      .select("*")
      .single();
    if (updErr) throw new Error(updErr.message);
    return { run: updated };
  });

/**
 * UNDO — roll back the last applied fix. Re-queues the prior file content (or a
 * delete for files the fix created) through the plugin, and marks the run
 * 'rolled_back'. Safe: only operates on the user's own project.
 */
export const rollbackPlaytestRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ runId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: run, error: runErr } = await supabase
      .from("playtest_runs")
      .select("*")
      .eq("id", data.runId)
      .single();
    if (runErr || !run) throw new Error("Playtest run not found.");
    if (run.user_id !== userId) throw new Error("Not your run.");
    if (!["applying", "verifying", "done", "failed"].includes(run.status))
      throw new Error(`Nothing to roll back for a '${run.status}' run.`);

    const snap = (run.rollback_snapshot ?? []) as Array<{
      path: string;
      prior_content: string | null;
      existed: boolean;
    }>;
    if (snap.length === 0) throw new Error("This run has no rollback snapshot.");

    const rows = snap.map((s) =>
      s.existed
        ? {
            project_id: run.project_id,
            user_id: userId,
            action_type: "script",
            payload: { type: "script", path: s.path, source: s.prior_content ?? "" },
            status: "pending" as const,
          }
        : {
            project_id: run.project_id,
            user_id: userId,
            action_type: "delete",
            payload: { type: "delete", path: s.path },
            status: "pending" as const,
          },
    );
    const { error: insErr } = await supabaseAdmin.from("plugin_actions").insert(rows);
    if (insErr) throw new Error("Failed to queue rollback: " + insErr.message);

    const { data: updated, error: updErr } = await supabase
      .from("playtest_runs")
      .update({ status: "rolled_back", updated_at: new Date().toISOString() })
      .eq("id", run.id)
      .select("*")
      .single();
    if (updErr) throw new Error(updErr.message);
    return { run: updated, reverted: rows.length };
  });
