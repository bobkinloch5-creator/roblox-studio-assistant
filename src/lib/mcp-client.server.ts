import { tool } from "ai";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Minimal MCP Streamable HTTP JSON-RPC client.
// Initializes per request, lists tools, and exposes a single callable.

type McpServer = {
  id: string;
  name: string;
  url: string;
  auth_header: string | null;
};

function isOwnMcpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = u.pathname.replace(/\/+$/, "");
    const isOurs =
      host === "bloxsmith.pro" ||
      host === "www.bloxsmith.pro" ||
      host.endsWith(".lovable.app") ||
      host === "localhost";
    return isOurs && path === "/api/public/mcp";
  } catch {
    return false;
  }
}

function randomToken(len = 32) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(text: string) {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function ensureOwnToken(userId: string): Promise<string> {
  const token = "bsmcp_" + randomToken(32);
  const hash = await sha256(token);
  await supabaseAdmin
    .from("mcp_tokens")
    .upsert(
      { user_id: userId, token_hash: hash, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  return token;
}

/**
 * Normalize whatever the user pasted into a valid Authorization header value.
 * Accepts bare tokens ("bsmcp_xxx", "sk-...", "ghp_..."), or fully-formed
 * "Bearer xxx" / "Basic xxx" / "Token xxx" strings.
 */
function normalizeAuthHeader(raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  if (!v) return "";
  if (/^(Bearer|Basic|Token)\s+/i.test(v)) return v;
  return `Bearer ${v}`;
}

async function resolveAuthHeader(server: McpServer, userId: string): Promise<string> {
  if (isOwnMcpUrl(server.url)) {
    const adminSecret = process.env.MCP_SECRET;
    if (adminSecret) return `Bearer ${adminSecret}`;
    const token = await ensureOwnToken(userId);
    return `Bearer ${token}`;
  }
  return normalizeAuthHeader(server.auth_header);
}

async function mcpRpc(
  server: McpServer,
  authHeader: string,
  method: string,
  params?: any,
  id = 1,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (authHeader) headers["Authorization"] = authHeader;
  const r = await fetch(server.url, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  if (!r.ok) {
    if (r.status === 401 || r.status === 403) {
      throw new Error(
        `MCP ${server.name}: ${r.status} Unauthorized — token in /mcp-servers is missing or invalid. Update it and try again.`,
      );
    }
    throw new Error(`MCP ${server.name} HTTP ${r.status}`);
  }
  const ct = r.headers.get("content-type") ?? "";
  let data: any;
  if (ct.includes("text/event-stream")) {
    const text = await r.text();
    const line = text
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.startsWith("data:"));
    if (!line) throw new Error(`MCP ${server.name}: empty SSE`);
    data = JSON.parse(line.slice(5).trim());
  } else {
    data = await r.json();
  }
  if (data.error) throw new Error(`MCP ${server.name}: ${data.error.message}`);
  return data.result;
}

async function initAndList(server: McpServer, authHeader: string) {
  await mcpRpc(server, authHeader, "initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "bloxsmith", version: "1.0.0" },
  });
  // Streamable HTTP servers expect a notification after initialize
  try {
    await fetch(server.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    });
  } catch {}
  const result = await mcpRpc(server, authHeader, "tools/list", {}, 2);
  return (result?.tools ?? []) as Array<{
    name: string;
    description?: string;
    inputSchema?: any;
  }>;
}

function sanitizeName(s: string) {
  return s.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 50);
}

// Build AI SDK tool wrappers for every tool exposed by every user MCP server.
export async function buildUserMcpTools(userId: string) {
  const { data: servers } = await supabaseAdmin
    .from("user_mcp_servers")
    .select("id,name,url,auth_header")
    .eq("user_id", userId)
    .eq("enabled", true);
  if (!servers || servers.length === 0) return {};

  const tools: Record<string, any> = {};
  await Promise.all(
    servers.map(async (s) => {
      const server = s as McpServer;
      let authHeader = "";
      try {
        authHeader = await resolveAuthHeader(server, userId);
      } catch (e) {
        console.error(`[mcp] could not resolve auth for ${server.name}:`, e);
        return;
      }
      try {
        const list = await initAndList(server, authHeader);
        for (const t of list) {
          const key = `mcp_${sanitizeName(server.name)}_${sanitizeName(t.name)}`;
          tools[key] = tool({
            description: `[MCP:${server.name}] ${t.description ?? t.name}`,
            inputSchema: z.object({}).passthrough(),
            execute: async (args: any) => {
              try {
                const res = await mcpRpc(
                  server,
                  authHeader,
                  "tools/call",
                  { name: t.name, arguments: args ?? {} },
                  Date.now(),
                );
                return res;
              } catch (e: any) {
                return { error: e?.message ?? String(e) };
              }
            },
          });
        }
      } catch (e) {
        console.error(`[mcp] failed to load ${server.name}:`, e);
      }
    }),
  );
  return tools;
}
