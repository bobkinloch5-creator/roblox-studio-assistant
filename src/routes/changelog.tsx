import { createFileRoute, Link } from "@tanstack/react-router";
import { Header, Footer } from "@/components/layout";
import {
  Bot,
  Boxes,
  CheckCircle,
  Cpu,
  FileCode,
  FolderKanban,
  Image,
  KeyRound,
  Layers,
  Map,
  Megaphone,
  Package,
  Palette,
  Play,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Wand2,
  Wrench,
  Zap,
} from "lucide-react";

const tagStyles = {
  ai: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  tools: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  backend: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  security: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  plugin: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  ui: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  integrations: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

const changelogItems = [
  {
    version: "v2.6.0",
    date: "May 28, 2026",
    title: "Security, Speed & Gemini Image Generation Upgrade",
    description:
      "A stability and safety release for the BloxSmith website, AI chat, model gateway, Roblox plugin organizer, and upcoming Roblox-ready image generation workflow.",
    updates: [
      {
        category: "Performance",
        tagColor: tagStyles.backend,
        icon: Zap,
        title: "Smoother AI Chat Performance",
        detail:
          "Assistant messages are now memoized so long chats do not re-render every old message on each keystroke, status poll, or timer update. This helps reduce typing lag in big projects.",
      },
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "Removed Hardcoded API Key Fallbacks",
        detail:
          "Server AI providers, model tests, and plugin organizer routes now rely on secure environment variables instead of embedded Groq fallback keys. This keeps private keys out of source code going forward.",
      },
      {
        category: "AI Gateway",
        tagColor: tagStyles.integrations,
        icon: Server,
        title: "Cleaner Provider Routing",
        detail:
          "Improved routing and fallback behavior for Groq, Neokens, Gemini, OpenAI-compatible, and Claude-style providers. Missing provider keys now fail safer and are easier to diagnose.",
      },
      {
        category: "Admin Tools",
        tagColor: tagStyles.backend,
        icon: Cpu,
        title: "Improved Model Diagnostics",
        detail:
          "Admin model testing now reports clearer missing-key, timeout, rate-limit, auth, provider, and model-not-found errors. The test prompt was updated so reasoning models return visible replies more reliably.",
      },
      {
        category: "Roblox Plugin",
        tagColor: tagStyles.plugin,
        icon: FolderKanban,
        title: "Safer Plugin Organizer Queue",
        detail:
          "The organize endpoint keeps projects private per user, validates ownership before queueing plugin actions, and uses secure server AI configuration for organize, move, and rename tasks.",
      },
      {
        category: "Images",
        tagColor: tagStyles.tools,
        icon: Image,
        title: "Gemini Image Generation Prepared",
        detail:
          "Prepared Gemini image generation for Roblox-ready thumbnails, icons, decals, GUI art, posters, badges, loading screens, and concept art with aspect ratios for 16:9 thumbnails, 1:1 icons/decals, and 9:16 mobile art.",
      },
    ],
  },
  {
    version: "v2.5.0",
    date: "May 27, 2026",
    title: "Full Roblox Creation Assistant",
    description:
      "BloxSmith AI evolves from a script generator into a complete Roblox build agent: maps, GUIs, tools, animations, VFX, full game systems, and procedural worlds — all placed correctly inside Studio.",
    updates: [
      {
        category: "AI",
        tagColor: tagStyles.ai,
        icon: Wand2,
        title: "Six New Build Modes",
        detail:
          "Added Animation Helper, VFX Builder, Game System Builder, Procedural Generator, Toolbox Finder, and Finish My Game modes with deeper implementation guidance.",
      },
      {
        category: "AI",
        tagColor: tagStyles.ai,
        icon: Boxes,
        title: "Procedural World Generation",
        detail:
          "Ask for an obby, mining sim, forest, city block, lobby, tycoon, or cave system and the AI can generate scene structure, parts, materials, NPCs, and gameplay logic.",
      },
      {
        category: "Placement",
        tagColor: tagStyles.backend,
        icon: Layers,
        title: "Correct Studio Service Placement",
        detail:
          "Generated items are guided toward Workspace, ServerScriptService, ReplicatedStorage, ServerStorage, StarterGui, StarterPack, StarterPlayer, Lighting, SoundService, Teams, and clean folder structures.",
      },
      {
        category: "AI",
        tagColor: tagStyles.backend,
        icon: FolderKanban,
        title: "Structured Response Contract",
        detail:
          "Every build response now explains what was made, how it works, where it goes, how to test it, safety notes, and the suggested next task.",
      },
    ],
  },
  {
    version: "v2.4.0",
    date: "May 27, 2026",
    title: "Real Toolbox Assets & Map Insertion",
    description:
      "The AI can find and insert real free assets from the Roblox creator marketplace — maps, models, props, and full scenes.",
    updates: [
      {
        category: "AI Tools",
        tagColor: tagStyles.tools,
        icon: Map,
        title: "Real Map & Asset Insertion",
        detail:
          "Asset lookups use a server-friendly toolbox endpoint and rank results by popularity signals so BloxSmith can pick better Roblox marketplace assets.",
      },
      {
        category: "AI Tools",
        tagColor: tagStyles.tools,
        icon: Package,
        title: "Map Intent Safety Net",
        detail:
          "When you ask for a map, world, lobby, or city and no toolbox insert is queued, the AI tries to find and queue a free asset so you do not get an empty result.",
      },
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "Free + Script-Scanned by Default",
        detail:
          "Auto-inserted toolbox assets are restricted to free items and pass through the quarantine scanner before they touch your place.",
      },
    ],
  },
  {
    version: "v2.3.0",
    date: "May 27, 2026",
    title: "Smarter Models & UI/GUI Generation",
    description:
      "Hardened model routing so BloxSmith models have the right token budgets and capabilities for UI, GUI, animation, and full-game generation.",
    updates: [
      {
        category: "AI",
        tagColor: tagStyles.integrations,
        icon: Sparkles,
        title: "UI & GUI Animation Generation",
        detail:
          "BloxSmith can design and code complete GUIs with TweenService animations, hover states, and polished layouts — not just gameplay scripts.",
      },
      {
        category: "Backend",
        tagColor: tagStyles.backend,
        icon: Wrench,
        title: "Per-Model Token Tuning",
        detail:
          "Each model tier now has a more appropriate context window and output token budget so longer builds are less likely to truncate mid-script.",
      },
    ],
  },
  {
    version: "v2.2.0",
    date: "May 26, 2026",
    title: "MCP Servers & Promote-to-Earn",
    description:
      "A platform expansion: connect your own MCP servers and earn free credits by promoting BloxSmith on TikTok or YouTube.",
    updates: [
      {
        category: "Integrations",
        tagColor: tagStyles.integrations,
        icon: Server,
        title: "MCP Server Support with Status Indicators",
        detail:
          "Connect custom Model Context Protocol servers to extend the AI with your own tools. Each server shows live status indicators on the MCP Servers page.",
      },
      {
        category: "AI",
        tagColor: tagStyles.backend,
        icon: Bot,
        title: "AI Can Manage MCP Servers",
        detail:
          "You can ask the AI chat to list, add, and remove MCP servers on your account through built-in tools.",
      },
      {
        category: "Rewards",
        tagColor: tagStyles.security,
        icon: Megaphone,
        title: "Promote & Earn Free Credits",
        detail:
          "Post a TikTok or YouTube video promoting BloxSmith, submit the link from your account page, and earn free credits once approved.",
      },
    ],
  },
  {
    version: "v2.1.0",
    date: "May 26, 2026",
    title: "Extended Project Scanner & Edit Mode Verification",
    description:
      "A major update to the Roblox Studio plugin and website communication layer for reliability, security, and project awareness.",
    updates: [
      {
        category: "Roblox Plugin",
        tagColor: tagStyles.plugin,
        icon: Play,
        title: "Roblox Studio Edit Mode Verification",
        detail:
          "The plugin checks if you are running the game and warns before building during Play Mode so temporary play-mode changes are not lost.",
      },
      {
        category: "Roblox Plugin",
        tagColor: tagStyles.plugin,
        icon: FolderKanban,
        title: "Workspace.BloxSmithBuilds Grouping",
        detail:
          "Custom AI builds group under a dedicated BloxSmithBuilds folder in Workspace to keep your game hierarchy clean.",
      },
      {
        category: "Scanner",
        tagColor: tagStyles.plugin,
        icon: RefreshCw,
        title: "Extended Project Scanner & Property Sync",
        detail:
          "The scanner syncs key Roblox services, properties, and script checksums so the AI has better spatial and project awareness.",
      },
      {
        category: "Security",
        tagColor: tagStyles.tools,
        icon: KeyRound,
        title: "Secure Supabase Queue Bypass",
        detail:
          "Database action queue handling was reworked with secure server-side functions while keeping admin credentials away from browsers and plugins.",
      },
    ],
  },
  {
    version: "v2.0.0",
    date: "May 24, 2026",
    title: "Migration to Groq AI & Complete UI Overhaul",
    description:
      "Core AI generation was rebuilt for faster responses, cleaner chat, and improved Roblox action generation.",
    updates: [
      {
        category: "Backend",
        tagColor: tagStyles.backend,
        icon: Cpu,
        title: "Groq Llama-3.3-70b Integration",
        detail:
          "Added ultra-fast Groq-hosted model routing, reasoning support for complex systems, and JSON repair for structured Roblox action generation.",
      },
      {
        category: "UI/UX",
        tagColor: tagStyles.ui,
        icon: FileCode,
        title: "Chat Redesign & Suggestion Cards",
        detail:
          "Polished chat layout with prompt suggestion cards, model tags, thinking toggles, and cleaner message bubbles.",
      },
      {
        category: "Security",
        tagColor: tagStyles.tools,
        icon: ShieldCheck,
        title: "Creator Store Safety Scanner",
        detail:
          "The plugin scans toolbox models and strips dangerous scripts before inserted assets can affect your Roblox game.",
      },
    ],
  },
];

export const Route = createFileRoute("/changelog")({
  component: ChangelogPage,
  head: () => ({
    meta: [
      { title: "Changelog — BloxSmith" },
      {
        name: "description",
        content:
          "Stay updated with the latest BloxSmith releases, AI upgrades, plugin changes, security fixes, and bug fixes.",
      },
      { property: "og:title", content: "Changelog — BloxSmith" },
      { property: "og:description", content: "Latest BloxSmith releases, features, security updates, and fixes." },
      { property: "og:url", content: "https://bloxsmith.pro/changelog" },
    ],
    links: [{ rel: "canonical", href: "https://bloxsmith.pro/changelog" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "BloxSmith Changelog",
          url: "https://bloxsmith.pro/changelog",
          blogPost: changelogItems.slice(0, 4).map((item) => ({
            "@type": "BlogPosting",
            headline: item.title,
            description: item.description,
            datePublished: item.date,
            author: { "@type": "Organization", name: "BloxSmith" },
            url: `https://bloxsmith.pro/changelog#${item.version.replace(/\./g, "-")}`,
          })),
        }),
      },
    ],
  }),
});

function ChangelogPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-16">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1 text-xs text-muted-foreground mb-4">
            <Sparkles className="h-3 w-3 text-primary-glow" /> BloxSmith updates
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            What's <span className="gradient-text">New</span>
          </h1>
          <p className="mt-4 text-muted-foreground text-base sm:text-lg">
            Follow the latest website upgrades, AI improvements, Roblox Studio plugin changes, security fixes, and platform changelogs.
          </p>
        </div>

        <h2 className="sr-only">Release timeline</h2>
        <div className="space-y-16 relative before:absolute before:inset-0 before:left-4 sm:before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-border/60 before:h-full">
          {changelogItems.map((item) => (
            <div id={item.version.replace(/\./g, "-")} key={item.version} className="relative flex flex-col sm:flex-row items-start sm:gap-12 group scroll-mt-24">
              <div className="absolute left-4 sm:left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-surface border-2 border-primary grid place-items-center z-10 shadow-lg group-hover:scale-110 transition-transform">
                <CheckCircle className="h-4 w-4 text-primary" />
              </div>

              <div className="pl-12 sm:pl-0 sm:w-1/2 sm:text-right pt-1.5 flex sm:flex-col items-baseline sm:items-end gap-2 justify-start">
                <span className="text-xl sm:text-2xl font-black text-foreground">{item.version}</span>
                <span className="text-xs font-semibold text-muted-foreground/80 bg-surface px-2.5 py-1 rounded-full border border-border">
                  {item.date}
                </span>
              </div>

              <div className="pl-12 sm:pl-0 sm:w-1/2 mt-4 sm:mt-0">
                <div className="glass rounded-2xl p-6 sm:p-8 hover:border-primary/30 transition-all duration-300">
                  <h3 className="text-lg sm:text-xl font-bold tracking-tight mb-2 text-foreground/90">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6">{item.description}</p>

                  <div className="space-y-6">
                    {item.updates.map((upd, uIdx) => {
                      const Icon = upd.icon;
                      return (
                        <div key={uIdx} className="flex gap-4 items-start">
                          <div className="flex-shrink-0 h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary-glow">
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-foreground">{upd.title}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${upd.tagColor}`}>
                                {upd.category}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{upd.detail}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20 text-center glass rounded-2xl p-8 max-w-xl mx-auto">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary-glow mb-4">
            <Palette className="h-5 w-5" />
          </div>
          <h4 className="text-lg font-bold">Have suggestions or issues?</h4>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            BloxSmith is updated often to improve Roblox development workflows, plugin reliability, AI generation quality, and security.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Link to="/plugin" className="text-xs font-semibold text-primary hover:text-primary-glow underline">
              Download Latest Plugin
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link to="/docs" className="text-xs font-semibold text-primary hover:text-primary-glow underline">
              Read the Docs
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
