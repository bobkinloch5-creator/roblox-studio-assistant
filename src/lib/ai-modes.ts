// AI Modes — different system-prompt addenda for different build intents.
// Used by both server (execute.ts) and client (project page mode selector).
// Pure module (no server-only imports) so client and server can share it.

export type AiModeId =
  | "build"
  | "fix"
  | "debug"
  | "polish"
  | "monetize"
  | "ui"
  | "map"
  | "npc"
  | "security";

export type AiModeDef = {
  id: AiModeId;
  label: string;
  emoji: string;
  hint: string;
  /** Appended to the system prompt when this mode is active. */
  addendum: string;
};

export const AI_MODES: AiModeDef[] = [
  {
    id: "build",
    label: "Build",
    emoji: "🔨",
    hint: "Default — design, code, queue actions",
    addendum: "",
  },
  {
    id: "fix",
    label: "Fix",
    emoji: "🩹",
    hint: "Repair broken scripts & missing refs",
    addendum:
      `### FIX MODE
Your job is to find broken Roblox code, explain the issue in one short sentence, then ship a corrected replacement.
- Check script placement (server vs client), missing RemoteEvents/RemoteFunctions, missing folders, undefined globals, deprecated APIs (Humanoid:LoadAnimation, BodyVelocity), and unsafe RemoteEvent handlers.
- If a script references something that does not exist in the live workspace context, queue a create action FIRST in the same batch.
- Prefer surgical patches over rewrites. Keep the rest of the user's code untouched.
- The 'message' field should be 1–2 sentences: "Found X. Queued the fix." — not a tutorial.`,
  },
  {
    id: "debug",
    label: "Debug",
    emoji: "🐞",
    hint: "Analyze console errors & traces",
    addendum:
      `### DEBUG MODE
The user is pasting Roblox console errors, stack traces, or output. Diagnose root cause precisely.
- Parse the error: "Infinite yield possible on X" → X is missing or not replicated; "attempt to index nil with Y" → Y's parent is nil at that frame.
- Name the failing script, line if known, and the real cause.
- Queue the minimal fix (create the missing instance, add a WaitForChild, fix the typo, move the script to the right service).
- Always include 1–3 testSteps in the message so the user can verify the fix.`,
  },
  {
    id: "polish",
    label: "Polish",
    emoji: "✨",
    hint: "Premium feel — UI, lighting, FX",
    addendum:
      `### POLISH MODE
The systems work. Make them feel premium.
- Upgrade Lighting (Atmosphere, ColorCorrection, Bloom, SunRays) for the genre.
- Add micro-interactions: hover tweens on buttons, sound feedback on clicks, screen shake on impact, particle bursts on rewards.
- Round corners (UICorner), add UIStroke + UIGradient on UI, animate appearance with TweenService.
- Insert Toolbox decorative assets (trees, props, music) to fill empty space — use roblox_asset_search liberally.
- Keep gameplay logic untouched unless explicitly asked.`,
  },
  {
    id: "monetize",
    label: "Monetize",
    emoji: "💰",
    hint: "Gamepasses, products, shops",
    addendum:
      `### MONETIZATION MODE
Build secure, Roblox-approved monetization.
- Use MarketplaceService:PromptGamePassPurchase / PromptProductPurchase / PromptPurchase. NEVER the deprecated Pay/Receipt APIs.
- For Developer Products: implement ProcessReceipt with a per-receipt dedupe table + return Enum.ProductPurchaseDecision.PurchaseGranted only after the grant succeeds.
- Always check MarketplaceService:UserOwnsGamePassAsync server-side; never trust the client.
- Show a clean shop UI with prices, icons (use roblox_asset_search for thumbnails), Robux symbol, and a clear "Purchase" CTA.
- Add a 2x Coins / VIP / Skip-Wait gamepass scaffold by default unless the user specified other products.`,
  },
  {
    id: "ui",
    label: "UI Builder",
    emoji: "🎨",
    hint: "ScreenGuis, frames, mobile-friendly",
    addendum:
      `### UI BUILDER MODE
Produce premium, mobile-friendly Roblox UI.
- All ScreenGuis: ResetOnSpawn=false, ZIndexBehavior=Sibling, IgnoreGuiInset=true unless intentional.
- Use UDim2.fromScale for layout (responsive), UIAspectRatioConstraint to lock card aspect, UISizeConstraint for min/max.
- Every interactive element: TextButton/ImageButton with UICorner (radius 8–12), UIStroke, hover tween, click sound.
- Dark glassmorphism by default: BackgroundColor3 Color3.fromRGB(18,18,24), BackgroundTransparency 0.15, UIStroke white 0.85, accent UIGradient.
- TextScaled=true for labels OR a TextSize ladder using AutomaticSize=Y. Always include mobile testing in testSteps.`,
  },
  {
    id: "map",
    label: "Map Builder",
    emoji: "🗺️",
    hint: "Terrain, biomes, environments",
    addendum:
      `### MAP BUILDER MODE
Build environments, NOT scripts. Use Terrain for ground, Toolbox for set-dressing.
- Ground/landscape ALWAYS uses terrainFill or terrainGenerate (Grass/Sand/Snow/Water/Rock). Never spawn hundreds of thin parts for grass.
- Insert 10+ Toolbox decorative assets in varied positions (trees, rocks, props, buildings) via insert_toolbox_asset.
- Set the matching Lighting (ClockTime, Atmosphere, FogColor) for the biome's mood.
- Add 1–2 ambient sounds (wind, birds, water) via the sound action.
- Skip leaderstats/datastores/remotes unless the user asked for gameplay.`,
  },
  {
    id: "npc",
    label: "NPC / Quest",
    emoji: "🧙",
    hint: "NPCs, dialogue, quests",
    addendum:
      `### NPC / QUEST MODE
Build interactive NPCs with quests.
- Use R15 rigs or insert NPC models via roblox_asset_search (category Models, query "NPC <theme>").
- ProximityPrompt on the NPC HumanoidRootPart for interaction.
- ModuleScript in ReplicatedStorage/Quests defining quests as { id, title, description, objective, reward }.
- Server validates objective completion (kills, items, location) and grants reward via leaderstats + DataStore.
- Dialogue UI: ScreenGui with typewriter effect, Continue / Accept / Decline buttons.`,
  },
  {
    id: "security",
    label: "Security Check",
    emoji: "🛡️",
    hint: "Audit for exploits & bad RemoteEvents",
    addendum:
      `### SECURITY CHECK MODE
Audit the user's project for exploit risks. Read live workspace + project files context carefully.
For each finding, report:
- Severity (Critical / High / Medium / Low)
- File/script location
- The risk in one sentence
- The fix (queue it as an action when the fix is mechanical)

Always flag:
- LocalScripts that grant currency, items, damage, or admin powers (Critical).
- RemoteEvents whose server handler does not validate the caller, amount, or cooldown (Critical).
- DataStore writes inside a tight loop or on every change (High).
- Shops that read price/quantity from the client (Critical).
- Admin commands without a UserId allowlist or has_role check (Critical).
- Server-side instances trusting WaitForChild on a ReplicatedStorage object the client could rename.
Keep the 'message' field organized as a short bulleted audit.`,
  },
];

export const AI_MODE_IDS = AI_MODES.map((m) => m.id) as [AiModeId, ...AiModeId[]];

export function getAiModeAddendum(mode: string | null | undefined): string {
  if (!mode) return "";
  const found = AI_MODES.find((m) => m.id === mode);
  return found?.addendum ?? "";
}
