import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-plugin-token",
  "Content-Type": "application/json",
};

async function sha256(text: string) {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function userFromToken(token: string | null) {
  if (!token) return null;
  const hash = await sha256(token);
  const { data } = await supabaseAdmin
    .from("plugin_tokens")
    .select("user_id")
    .eq("token_hash", hash)
    .maybeSingle();
  return data?.user_id ?? null;
}

export const Route = createFileRoute("/api/studio/playtest-errors")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        try {
          const userId = await userFromToken(request.headers.get("x-plugin-token"));
          if (!userId) {
            return new Response(JSON.stringify({ error: "invalid token" }), { status: 401, headers: cors });
          }

          const body = await request.json().catch(() => ({}));
          const projectId = body?.projectId;
          const errors = body?.errors;
          if (!projectId || !Array.isArray(errors)) {
            return new Response(JSON.stringify({ error: "missing projectId or errors" }), {
              status: 400,
              headers: cors,
            });
          }

          // Verify project access (owner or collaborator).
          const { data: project } = await supabaseAdmin
            .from("projects")
            .select("id,user_id")
            .eq("id", projectId)
            .maybeSingle();
          if (!project) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: cors });
          let allowed = project.user_id === userId;
          if (!allowed) {
            const { data: c } = await supabaseAdmin
              .from("project_collaborators")
              .select("id")
              .eq("project_id", projectId)
              .eq("user_id", userId)
              .maybeSingle();
            allowed = !!c;
          }
          if (!allowed) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: cors });

          // Normalize + store. Cap how many we accept per batch.
          const rows = errors.slice(0, 40).map((e: any) => ({
            project_id: projectId,
            user_id: userId,
            message: String(e?.message ?? "").slice(0, 800),
            kind: e?.kind === "warning" ? "warning" : "error",
          }));

          if (rows.length > 0) {
            const { error: insErr } = await supabaseAdmin.from("playtest_errors").insert(rows);
            if (insErr && !/relation .*playtest_errors.* does not exist/i.test(insErr.message ?? "")) {
              console.warn("[playtest-errors] insert failed:", insErr.message);
            }
          }

          return new Response(JSON.stringify({ ok: true, received: rows.length }), {
            status: 200,
            headers: cors,
          });
        } catch (err: any) {
          console.error("[playtest-errors] error:", err?.message ?? err);
          return new Response(JSON.stringify({ error: "internal" }), { status: 500, headers: cors });
        }
      },
    },
  },
});
