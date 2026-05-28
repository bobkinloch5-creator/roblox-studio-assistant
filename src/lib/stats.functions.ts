import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getPublicStats = createServerFn({ method: "GET" }).handler(async () => {
  const [projectsRes, usersRes, showcaseRes, scriptsRes] = await Promise.all([
    supabaseAdmin.from("projects").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
    supabaseAdmin
      .from("projects")
      .select("*", { count: "exact", head: true })
      .eq("showcase_published", true),
    supabaseAdmin.from("project_files").select("*", { count: "exact", head: true }),
  ]);
  return {
    projects: projectsRes.count ?? 0,
    users: usersRes.count ?? 0,
    showcased: showcaseRes.count ?? 0,
    scripts: scriptsRes.count ?? 0,
  };
});

export const ensureStarterProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return { created: false, id: null as string | null };
  });
