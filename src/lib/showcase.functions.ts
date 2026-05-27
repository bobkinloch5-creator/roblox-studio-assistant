import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const publishToShowcase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      projectId: z.string().uuid(),
      title: z.string().min(2).max(120),
      description: z.string().min(10).max(500),
      thumbnailUrl: z.string().url().optional().nullable(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("projects")
      .update({
        showcase_published: true,
        showcase_title: data.title,
        showcase_description: data.description,
        showcase_thumbnail_url: data.thumbnailUrl ?? null,
        showcase_published_at: new Date().toISOString(),
      })
      .eq("id", data.projectId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unpublishFromShowcase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ projectId: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("projects")
      .update({ showcase_published: false })
      .eq("id", data.projectId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleShowcaseLike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ projectId: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("showcase_likes")
      .select("id")
      .eq("project_id", data.projectId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) {
      await supabase.from("showcase_likes").delete().eq("id", existing.id);
      return { liked: false };
    }
    const { error } = await supabase
      .from("showcase_likes")
      .insert({ project_id: data.projectId, user_id: userId });
    if (error) throw new Error(error.message);
    return { liked: true };
  });

export const remixShowcaseProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      sourceId: z.string().uuid(),
      newName: z.string().min(1).max(120).optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const newName = (data.newName ?? "").trim() || "Remix";
    const { data: newId, error } = await supabase.rpc("remix_showcase_project", {
      _source_id: data.sourceId,
      _new_name: newName,
    });
    if (error) throw new Error(error.message);
    return { projectId: newId as string };
  });
