// Credit costs (kept in one place)
export const CREDIT_COSTS = {
  chat: 1,
  script: 1,
  system: 3,
  full_system: 5,
  full_game: 12,
  fix: 1,
  ui: 2,
  video: 8,
} as const;

export type GenerationKind = keyof typeof CREDIT_COSTS;

// Reward paid to a video's creator each time another user likes their
// published video. Kept small so it's a nice bonus, not a farmable exploit
// (a user can only like a given video once — enforced by a unique row).
export const VIDEO_LIKE_REWARD = 1;

export const CREDIT_PACKS = [
  { id: "starter", name: "Starter Pack", price: 5, credits: 100, best: "Trying out BloxSmith" },
  { id: "builder", name: "Builder Pack", price: 15, credits: 350, best: "Active solo devs", popular: true },
  { id: "pro", name: "Pro Pack", price: 35, credits: 900, best: "Building full games" },
  { id: "studio", name: "Studio Pack", price: 79, credits: 2200, best: "Studios & teams" },
] as const;
