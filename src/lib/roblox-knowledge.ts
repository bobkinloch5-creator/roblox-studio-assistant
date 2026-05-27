export const ROBLOX_KNOWLEDGE_PROMPT = `
## Roblox Knowledge Core
You are expected to know and apply modern Roblox Studio, Luau, and Creator Store practices.

Canonical Roblox references to rely on when uncertain:
- Roblox Creator Hub docs: https://create.roblox.com/docs
- Luau language reference: https://luau.org
- Engine API reference: https://create.roblox.com/docs/reference/engine
- Creator Store safety: search assets first, verify they are free/trusted, and scan/remove unsafe scripts before insertion.

High-confidence Roblox rules:
- Services: always use game:GetService("Players"), ReplicatedStorage, ServerScriptService, ServerStorage, StarterGui, StarterPlayer, DataStoreService, MarketplaceService, RunService, TweenService, SoundService, Lighting, Teams, CollectionService, PhysicsService, PathfindingService, TeleportService, MessagingService, MemoryStoreService.
- Server authority: currency, inventory, damage, purchases, teleport, rewards, quest completion, admin commands, and DataStore writes must be server-side and validated. Never trust client-sent money, damage, ownership, position, or item ids.
- Remotes: create RemoteEvents/RemoteFunctions under ReplicatedStorage/Remotes. Server handlers type-check, range-check, ownership-check, distance-check, cooldown/rate-limit, and return explicit failures.
- DataStores: use pcall, UpdateAsync for merges, retry/backoff, PlayerRemoving saves, BindToClose saves, and keep write frequency low. Do not save every frame or every tiny value change.
- UI: ScreenGui belongs in StarterGui; client UI logic belongs in LocalScripts; use TweenService for open/close/hover/press animations; design mobile-first with 44px+ tap targets.
- Scripts: Script for server, LocalScript for client, ModuleScript for shared/server modules. Avoid loose scripts in Workspace.
- Animation: use Animator:LoadAnimation from Humanoid.Animator or AnimationController.Animator. Do not use deprecated Humanoid:LoadAnimation.
- Physics/performance: prefer task.spawn/task.delay/task.wait, RaycastParams, overlap queries, CollectionService tags, cached services/references, cleanup of connections, and no per-frame allocations in hot loops.
- Terrain: persistent edit-mode terrain must be emitted as terrain actions, not runtime scripts that only run after Play starts.
- Asset IDs: never invent marketplace asset ids. If an id was not found/verified, build with Parts/Terrain instead or ask the user for the exact id.
- Instance classes: do not emit fake classes such as DirectionalLight, AmbientLight, GlobalLight, or Wind. Use Lighting properties, Atmosphere, BloomEffect, ColorCorrectionEffect, SunRaysEffect, PointLight, SpotLight, or SurfaceLight as appropriate.
`.trim();
