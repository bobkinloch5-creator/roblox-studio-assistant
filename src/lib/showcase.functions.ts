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

// ---------------------------------------------------------------------------
// Featured Creator — public, no-auth-needed pick of the top showcased project
// in the last 7 days (by likes), to surface on the homepage. Falls back to the
// all-time top if nothing was published this week.
// ---------------------------------------------------------------------------
import { createClient } from "@supabase/supabase-js";

export type FeaturedCreator = {
  projectId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  likes: number;
  remixes: number;
  publishedAt: string | null;
  creator: { id: string; displayName: string | null; avatarUrl: string | null } | null;
  window: "weekly" | "all-time";
} | null;

export const getFeaturedCreator = createServerFn({ method: "GET" })
  .handler(async (): Promise<{ featured: FeaturedCreator }> => {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const sb = createClient(url, key);

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    let window: "weekly" | "all-time" = "weekly";

    let { data: rows } = await sb
      .from("projects")
      .select("id,showcase_title,showcase_description,showcase_thumbnail_url,showcase_likes_count,showcase_remix_count,showcase_published_at,user_id,name")
      .eq("showcase_published", true)
      .gte("showcase_published_at", weekAgo)
      .order("showcase_likes_count", { ascending: false })
      .order("showcase_published_at", { ascending: false })
      .limit(1);

    if (!rows || rows.length === 0) {
      window = "all-time";
      const fallback = await sb
        .from("projects")
        .select("id,showcase_title,showcase_description,showcase_thumbnail_url,showcase_likes_count,showcase_remix_count,showcase_published_at,user_id,name")
        .eq("showcase_published", true)
        .order("showcase_likes_count", { ascending: false })
        .order("showcase_published_at", { ascending: false })
        .limit(1);
      rows = fallback.data ?? [];
    }

    if (!rows || rows.length === 0) return { featured: null };

    const p = rows[0];
    const { data: profile } = await sb
      .from("profiles")
      .select("id,display_name,avatar_url")
      .eq("id", p.user_id)
      .maybeSingle();

    return {
      featured: {
        projectId: p.id,
        title: p.showcase_title || p.name,
        description: p.showcase_description,
        thumbnailUrl: p.showcase_thumbnail_url,
        likes: p.showcase_likes_count ?? 0,
        remixes: p.showcase_remix_count ?? 0,
        publishedAt: p.showcase_published_at,
        creator: profile
          ? { id: profile.id, displayName: profile.display_name, avatarUrl: profile.avatar_url }
          : null,
        window,
      },
    };
  });
