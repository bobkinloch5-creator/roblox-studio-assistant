import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ProjectSchema = z.object({ projectId: z.string().uuid() });
const RememberSchema = z.object({
  projectId: z.string().uuid(),
  value: z.string().min(3).max(1000),
  kind: z.enum(["preference", "project_fact", "recent"]).default("preference"),
});
const ForgetSchema = z.object({
  projectId: z.string().uuid(),
  id: z.string().uuid(),
});

async function assertProjectOwner(supabase: any, projectId: string, userId: string) {
  const { data, error } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) throw new Error("Project not found or unauthorized.");
}

function memoryKey(value: string) {
  const slug =
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 54) || "note";
  return `manual_${slug}`.slice(0, 80);
}

export const listProjectAiMemories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProjectSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertProjectOwner(supabase, data.projectId, userId);
    const { data: rows, error } = await supabase
      .from("project_ai_memories")
      .select("id,key,kind,value,confidence,updated_at,last_seen_at")
      .eq("project_id", data.projectId)
      .order("last_seen_at", { ascending: false })
      .limit(40);
    if (error) throw new Error(error.message);
    return { memories: rows ?? [] };
  });

export const rememberProjectNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RememberSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertProjectOwner(supabase, data.projectId, userId);
    const clean = data.value.replace(/\s+/g, " ").trim();
    const { error } = await supabase.from("project_ai_memories").upsert(
      {
        project_id: data.projectId,
        user_id: userId,
        key: memoryKey(clean),
        kind: data.kind,
        value: clean,
        confidence: 0.95,
        source_prompt: `Manual memory: ${clean}`,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "project_id,key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const forgetProjectAiMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ForgetSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertProjectOwner(supabase, data.projectId, userId);
    const { error } = await supabase
      .from("project_ai_memories")
      .delete()
      .eq("project_id", data.projectId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
