import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Header, Footer } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toggleShowcaseLike, remixShowcaseProject } from "@/lib/showcase.functions";
import { Heart, GitFork, Sparkles, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/showcase/$projectId")({
  component: ShowcaseDetail,
});

function ShowcaseDetail() {
  const { projectId } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const like = useServerFn(toggleShowcaseLike);
  const remix = useServerFn(remixShowcaseProject);

  const { data, isLoading } = useQuery({
    queryKey: ["showcase", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id, showcase_title, showcase_description, showcase_thumbnail_url, showcase_likes_count, showcase_remix_count, name, game_type, description"
        )
        .eq("id", projectId)
        .eq("showcase_published", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: liked } = useQuery({
    queryKey: ["showcase-liked", projectId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("showcase_likes")
        .select("id")
        .eq("project_id", projectId)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
  });

  const likeMut = useMutation({
    mutationFn: () => like({ data: { projectId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["showcase", projectId] });
      qc.invalidateQueries({ queryKey: ["showcase-liked", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remixMut = useMutation({
    mutationFn: () => remix({ data: { sourceId: projectId } }),
    onSuccess: (res) => {
      toast.success("Remixed into your workspace!");
      nav({ to: "/project/$projectId", params: { projectId: res.projectId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h1 className="text-2xl font-bold">Project not found</h1>
          <p className="text-muted-foreground mt-2">
            This project may have been unpublished.
          </p>
          <Link to="/showcase" className="mt-6 inline-block text-primary-glow">
            ← Back to showcase
          </Link>
        </main>
      </div>
    );
  }

  const title = data.showcase_title ?? data.name;
  const desc = data.showcase_description ?? data.description ?? "";

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
        <Link
          to="/showcase"
          className="inline-flex items-center gap-1.