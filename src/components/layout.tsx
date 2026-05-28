import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import logo from "@/assets/logo.png";
import { useState } from "react";
import { Menu, X, User, Settings, CreditCard, LogOut, ChevronDown } from "lucide-react";
import { PluginStatus } from "@/components/PluginStatus";
import { McpStatus } from "@/components/McpStatus";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Header() {
  const { user, signOut, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const initials = profile?.display_name
    ? profile.display_name.slice(0, 2).toUpperCase()
    : (profile?.email?.slice(0, 2).toUpperCase() ?? "?");

  const closeMenu = () => setOpen(false);

  return (
    <header className="sticky top-0 z-50 glass border-b border-border supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2.5 sm:px-6 sm:py-3">
        <Link to="/" onClick={closeMenu} className="flex min-w-0 items-center gap-2 shrink-0 notranslate" translate="no">
          <img src={logo} alt="BloxSmith logo" width={32} height={32} className="h-8 w-8 shrink-0" />
          <span className="truncate text-base sm:text-lg font-bold whitespace-nowrap">
            Blox<span className="gradient-text">Smith</span>
          </span>
          <span className="ml-1 hidden lg:inline-flex items-center rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 border border-amber-500/20">
            Beta
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-5 lg:gap-6 text-sm text-muted-foreground ml-4 shrink-0">
          <Link to="/templates" className="hover:text-foreground">Templates</Link>
          <Link to="/showcase" className="hover:text-foreground">Showcase</Link>
          <Link to="/ideas" className="hover:text-foreground">Ideas</Link>
          <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
          <Link to="/docs" className="hover:text-foreground">Docs</Link>
          <Link to="/plugin" className="hover:text-foreground">Plugin</Link>
          <Link to="/mcp" className="hover:text-foreground">MCP</Link>
          <Link to="/changelog" className="hover:text-foreground">Changelog</Link>
          <a href="https://kingdavez.click" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
            3D Models
          </a>
          {user && <Link to="/dashboard" className="hover:text-foreground">Dashboard</Link>}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <a
            href="https://discord.gg/J9TU7syJCr"
            target="_blank"
            rel="noopener noreferrer"
            title="Join the BloxSmith Discord — +5 free credits"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#5865F2]/15 hover:bg-[#5865F2]/25 border border-[#5865F2]/30 px-2.5 py-1 text-xs font-semibold text-[#7c8ff5] transition"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden><path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3c-.18.327-.39.766-.535 1.117a18.27 18.27 0 0 0-5.487 0C10.39 3.766 10.175 3.327 9.992 3a19.736 19.736 0 0 0-3.76 1.369C2.4 9.97 1.36 15.42 1.87 20.785a19.9 19.9 0 0 0 5.99 3.03c.484-.66.917-1.363 1.29-2.104-.71-.27-1.39-.6-2.03-.99.17-.124.336-.253.495-.386 3.93 1.83 8.18 1.83 12.06 0 .161.133.327.262.495.386-.643.39-1.324.72-2.034.99.374.74.806 1.443 1.29 2.103a19.852 19.852 0 0 0 5.992-3.03c.6-6.225-1.05-11.625-4.31-16.415zM8.02 17.045c-1.183 0-2.157-1.085-2.157-2.42 0-1.333.953-2.42 2.157-2.42 1.21 0 2.176 1.094 2.157 2.42 0 1.335-.953 2.42-2.157 2.42zm7.96 0c-1.184 0-2.157-1.085-2.157-2.42 0-1.333.952-2.42 2.157-2.42 1.21 0 2.176 1.094 2.156 2.42 0 1.335-.946 2.42-2.156 2.42z"/></svg>
            Discord +5
          </a>
          <ThemeToggle />
          <LanguageSwitcher />
          {user ? (
            <>
              <PluginStatus />
              <McpStatus />
              <Link
                to="/pricing"
                className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-semibold text-primary-glow hover:bg-primary/20 transition"
              >
                {profile?.credits ?? 0} credits
              </Link>

              <div className="relative">
                <button
                  onClick={() => setProfileOpen((o) => !o)}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-primary/80 to-accent/60 h-8 pl-1 pr-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition"
                >
                  <span className="h-6 w-6 rounded-full bg-primary-foreground/20 grid place-items-center text-[11px] font-bold">
                    {initials}
                  </span>
                  <span className="hidden lg:inline max-w-[100px] truncate">
                    {profile?.display_name || profile?.email?.split("@")[0]}
                  </span>
                  <ChevronDown className={`h-3 w-3 transition ${profileOpen ? "rotate-180" : ""}`} />
                </button>
                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 z-50 rounded-xl bg-surface-elevated border border-border shadow-2xl overflow-hidden animate-fade-in">
                      <div className="px-4 py-3 border-b border-border/40">
                        <p className="text-sm font-semibold truncate">{profile?.display_name || "Builder"}</p>
                        <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                      </div>
                      <div className="py-1.5">
                        <Link to="/account" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-4 py-2 text-sm text-foreground/90 hover:bg-surface-elevated transition">
                          <User className="h-3.5 w-3.5 text-muted-foreground" /> Profile
                        </Link>
                        <Link to="/account" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-4 py-2 text-sm text-foreground/90 hover:bg-surface-elevated transition">
                          <Settings className="h-3.5 w-3.5 text-muted-foreground" /> Settings
                        </Link>
                        <Link to="/pricing" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-4 py-2 text-sm text-foreground/90 hover:bg-surface-elevated transition">
                          <CreditCard className="h-3.5 w-3.5 text-muted-foreground" /> Buy Credits
                        </Link>
                      </div>
                      <div className="border-t border-border/40 py-1.5">
                        <button
                          onClick={() => {
                            setProfileOpen(false);
                            signOut();
                          }}
                          className="flex items-center gap-2.5 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 w-full transition"
                        >
                          <LogOut className="h-3.5 w-3.5" /> Sign out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">Log in</Link>
              <Link to="/signup" className="btn-shine rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-glow)]">
                Get started
              </Link>
            </>
          )}
        </div>

        <button
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface/60 text-foreground active:scale-95 transition"
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden fixed inset-x-0 top-[57px] z-50 max-h-[calc(100dvh-57px)] overflow-y-auto overscroll-contain border-t border-border bg-background/95 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl backdrop-blur-xl animate-fade-in">
          <div className="mx-auto max-w-md space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-border bg-surface/50 p-3">
              <div className="min-w-0">
                <p className="text-sm font-bold">BloxSmith</p>
                <p className="text-xs text-muted-foreground truncate">
                  {user ? `${profile?.credits ?? 0} credits available` : "Build Roblox games with AI"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ThemeToggle />
                <LanguageSwitcher compact />
              </div>
            </div>

            <nav className="grid grid-cols-2 gap-2 text-sm">
              <Link to="/templates" onClick={closeMenu} className="rounded-xl border border-border bg-surface/45 px-3 py-3 font-medium hover:bg-surface-elevated">Templates</Link>
              <Link to="/showcase" onClick={closeMenu} className="rounded-xl border border-border bg-surface/45 px-3 py-3 font-medium hover:bg-surface-elevated">Showcase</Link>
              <Link to="/ideas" onClick={closeMenu} className="rounded-xl border border-border bg-surface/45 px-3 py-3 font-medium hover:bg-surface-elevated">Ideas</Link>
              <Link to="/pricing" onClick={closeMenu} className="rounded-xl border border-border bg-surface/45 px-3 py-3 font-medium hover:bg-surface-elevated">Pricing</Link>
              <Link to="/docs" onClick={closeMenu} className="rounded-xl border border-border bg-surface/45 px-3 py-3 font-medium hover:bg-surface-elevated">Docs</Link>
              <Link to="/plugin" onClick={closeMenu} className="rounded-xl border border-border bg-surface/45 px-3 py-3 font-medium hover:bg-surface-elevated">Plugin</Link>
              <Link to="/mcp" onClick={closeMenu} className="rounded-xl border border-border bg-surface/45 px-3 py-3 font-medium hover:bg-surface-elevated">MCP</Link>
              <Link to="/changelog" onClick={closeMenu} className="rounded-xl border border-border bg-surface/45 px-3 py-3 font-medium hover:bg-surface-elevated">Changelog</Link>
              <a href="https://kingdavez.click" target="_blank" rel="noopener noreferrer" onClick={closeMenu} className="rounded-xl border border-border bg-surface/45 px-3 py-3 font-medium hover:bg-surface-elevated">
                3D Models
              </a>
              {user && <Link to="/dashboard" onClick={closeMenu} className="rounded-xl border border-border bg-surface/45 px-3 py-3 font-medium hover:bg-surface-elevated">Dashboard</Link>}
            </nav>

            <a
              href="https://discord.gg/J9TU7syJCr"
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeMenu}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#5865F2]/30 bg-[#5865F2]/15 px-4 py-3 text-sm font-bold text-[#8ea0ff]"
            >
              Join Discord +5 free credits
            </a>

            {user ? (
              <div className="space-y-2 rounded-2xl border border-border bg-surface/40 p-3">
                <Link to="/account" onClick={closeMenu} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm hover:bg-surface-elevated">
                  <User className="h-4 w-4 text-muted-foreground" /> Profile & Settings
                </Link>
                <Link to="/pricing" onClick={closeMenu} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-primary-glow hover:bg-primary/10">
                  <CreditCard className="h-4 w-4" /> Buy Credits
                </Link>
                <div className="grid grid-cols-1 gap-2 px-3 py-2">
                  <PluginStatus />
                  <McpStatus />
                </div>
                <button
                  onClick={() => {
                    closeMenu();
                    signOut();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link to="/login" onClick={closeMenu} className="rounded-xl border border-border px-4 py-3 text-center text-sm font-semibold">
                  Log in
                </Link>
                <Link to="/signup" onClick={closeMenu} className="btn-shine rounded-xl bg-primary px-4 py-3 text-center text-sm font-bold text-primary-foreground shadow-[var(--shadow-glow)]">
                  Get started
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <p>© {new Date().getFullYear()} BloxSmith. Build real Roblox games with AI.</p>
      </div>
    </footer>
  );
}
