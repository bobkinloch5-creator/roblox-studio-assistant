import { type ReactNode, useEffect } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Header, Footer } from "@/components/layout";
import { Lock, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  children: ReactNode;
  /** Optional custom message shown on the login gate. */
  message?: string;
};

/**
 * Client-side route guard for community/browse pages.
 * - Shows a clean "please log in" gate while unauthenticated.
 * - Auto-redirects to /login with the current path preserved so the user
 *   returns to where they were after signing in.
 * - RLS on the backend is the source of truth; this just stops UI access.
 */
export function RequireAuth({ children, message }: Props) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const here =
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : "/";
      const t = setTimeout(() => {
        try {
          router.navigate({
            to: "/login",
            search: { redirect: here } as any,
          });
        } catch {
          /* noop */
        }
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-md w-full text-center space-y-6 rounded-2xl border border-border bg-card/40 backdrop-blur p-8 shadow-xl">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Lock className="h-7 w-7 text-primary" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">
                Members only
              </h1>
              <p className="text-muted-foreground">
                {message ??
                  "Please log in to view and interact with community content."}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild className="gap-2">
                <Link to="/login">
                  <LogIn className="h-4 w-4" /> Log in
                </Link>
              </Button>
              <Button asChild variant="outline" className="gap-2">
                <Link to="/signup">
                  <UserPlus className="h-4 w-4" /> Create account
                </Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Redirecting you to login…
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return <>{children}</>;
}

export default RequireAuth;
