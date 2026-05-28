import { createFileRoute, Link } from "@tanstack/react-router";
import { Header, Footer } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, RefreshCw, Users, FolderKanban, Sparkles, CreditCard } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: Admin,
  head: () => ({
    meta: [
      { title: "Admin — BloxSmith" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
  credits: number;
  created_at?: string | null;
};

type Counts = { users: number; projects: number; generations: number };

function Admin() {
  const { user, isAdmin, loading, profile } = useAuth();
  const [counts, setCounts] = useState<Counts>({ users: 0, projects: 0, generations: 0 });
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pendingPayments, setPendingPayments] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function safeCount(table: "profiles" | "projects" | "generations" | "payment_requests", filterPending = false) {
    let query = supabase.from(table).select("id", { count: "exact", head: true });
    if (filterPending && table === "payment_requests") query = query.eq("status", "pending");
    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  }

  async function load() {
    if (!isAdmin) return;
    setRefreshing(true);
    setError(null);
    try {
      const [usersCount, projectsCount, generationsCount] = await Promise.all([
        safeCount("profiles"),
        safeCount("projects"),
        safeCount("generations"),
      ]);
      setCounts({ users: usersCount, projects: projectsCount, generations: generationsCount });
    } catch (err: any) {
      console.warn("Admin counts failed", err?.message ?? err);
      setError(err?.message ?? "Could not load admin stats.");
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,email,display_name,credits,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setUsers((data ?? []) as UserRow[]);
    } catch (err: any) {
      console.warn("Admin users failed", err?.message ?? err);
      setError((current) => current ?? (err?.message ?? "Could not load users."));
    }

    try {
      setPendingPayments(await safeCount("payment_requests", true));
    } catch (err: any) {
      console.warn("Admin payment count failed", err?.message ?? err);
    }
    setRefreshing(false);
  }

  useEffect(() => {
    if (!loading && isAdmin) load();
  }, [loading, isAdmin]);

  if (loading) {
    return <Shell><Panel>Loading admin…</Panel></Shell>;
  }

  if (!user) {
    return (
      <Shell>
        <Panel>
          <div className="text-center max-w-lg mx-auto">
            <ShieldCheck className="h-10 w-10 mx-auto text-primary mb-3" />
            <h1 className="text-2xl font-bold">Admin login required</h1>
            <p className="text-sm text-muted-foreground mt-2">Log in with your owner/admin account to open this page.</p>
            <Link to="/login" className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Log in</Link>
          </div>
        </Panel>
      </Shell>
    );
  }

  if (!isAdmin) {
    return (
      <Shell>
        <Panel>
          <div className="text-center max-w-lg mx-auto">
            <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h1 className="text-2xl font-bold">Admin access needed</h1>
            <p className="text-sm text-muted-foreground mt-2">Current account: {profile?.email ?? user.email}. Use the owner account or add this account to admin roles.</p>
            <Link to="/dashboard" className="mt-5 inline-flex rounded-lg border border-border px-4 py-2 text-sm font-semibold">Back to dashboard</Link>
          </div>
        </Panel>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><ShieldCheck className="h-7 w-7 text-primary" /> Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">Safe admin overview for BloxSmith.</p>
        </div>
        <button onClick={load} disabled={refreshing} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-surface disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Stat icon={Users} label="Users" value={counts.users} />
        <Stat icon={FolderKanban} label="Projects" value={counts.projects} />
        <Stat icon={Sparkles} label="Generations" value={counts.generations} />
        <Stat icon={CreditCard} label="Pending payments" value={pendingPayments} />
      </div>

      <Panel>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-bold">Recent users</h2>
          <Link to="/pricing" className="text-xs underline text-muted-foreground">Pricing page</Link>
        </div>
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users loaded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr><th className="py-2">Email</th><th>Name</th><th>Credits</th><th>Joined</th></tr>
              </thead>
              <tbody>
                {users.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="py-3 font-semibold">{row.email}</td>
                    <td className="text-muted-foreground">{row.display_name ?? "—"}</td>
                    <td>{row.credits ?? 0}</td>
                    <td className="text-xs text-muted-foreground">{row.created_at ? new Date(row.created_at).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-10 space-y-8">{children}</main>
      <Footer />
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <section className="glass rounded-2xl p-6">{children}</section>;
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground"><Icon className="h-4 w-4 text-primary" /> {label}</div>
      <div className="mt-2 text-3xl font-black">{value}</div>
    </div>
  );
}
