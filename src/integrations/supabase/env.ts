const PUBLIC_SUPABASE_URL_FALLBACK = "https://laolzicqlvwuhqulglge.supabase.co";
const PUBLIC_SUPABASE_PUBLISHABLE_KEY_FALLBACK =
  "sb_publishable_ryifgBEuDkvFaQmqrXoyoQ_3roSqXd2";

type EnvMap = Record<string, string | undefined>;

const runtimeEnv: EnvMap =
  typeof process !== "undefined" && process.env ? (process.env as EnvMap) : {};
const viteEnv: EnvMap = import.meta.env ?? {};

function firstEnv(...values: Array<string | undefined>) {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? "";
}

export function getSupabaseUrl() {
  return firstEnv(
    viteEnv.VITE_SUPABASE_URL,
    viteEnv.SUPABASE_URL,
    runtimeEnv.VITE_SUPABASE_URL,
    runtimeEnv.SUPABASE_URL,
    PUBLIC_SUPABASE_URL_FALLBACK,
  );
}

export function getSupabasePublishableKey() {
  return firstEnv(
    viteEnv.VITE_SUPABASE_PUBLISHABLE_KEY,
    viteEnv.VITE_SUPABASE_ANON_KEY,
    viteEnv.SUPABASE_PUBLISHABLE_KEY,
    viteEnv.SUPABASE_ANON_KEY,
    runtimeEnv.VITE_SUPABASE_PUBLISHABLE_KEY,
    runtimeEnv.VITE_SUPABASE_ANON_KEY,
    runtimeEnv.SUPABASE_PUBLISHABLE_KEY,
    runtimeEnv.SUPABASE_ANON_KEY,
    PUBLIC_SUPABASE_PUBLISHABLE_KEY_FALLBACK,
  );
}

export function getSupabaseServiceRoleKey() {
  return firstEnv(runtimeEnv.SUPABASE_SERVICE_ROLE_KEY, runtimeEnv.SUPABASE_SERVICE_KEY);
}

export function missingSupabasePublicEnv() {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  return [
    ...(!url ? ["SUPABASE_URL"] : []),
    ...(!key ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
  ];
}
