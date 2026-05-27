import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const checks = [
  {
    name: "Roblox docs search tool is available to models",
    file: "src/lib/ai-tools.server.ts",
    must: [/roblox_docs_search/, /searchRobloxDocs/, /strict:\s*true/],
  },
  {
    name: "Chat can use docs, web, and Roblox asset tools",
    file: "src/lib/ai.functions.ts",
    must: [/roblox_docs_search/, /roblox_asset_search/, /recordProviderHealth/, /compactChatHistory/, /pickChatTools/, /maxRetries:\s*0/],
  },
  {
    name: "Build path records provider health and uses model profiles",
    file: "src/routes/api/assistant/execute.ts",
    must: [/recordProviderHealth/, /getModelProfile/, /classifyProviderError/, /roblox_docs_search/, /Promise\.all/, /maxRetries:\s*0/],
  },
  {
    name: "Roblox safety validation blocks common backdoors",
    file: "src/lib/sync-validation.ts",
    must: [/BACKDOOR_PATTERNS/, /require\\s\*\\\(/, /loadstring/, /InsertService/],
  },
  {
    name: "Knowledge core tells models when to check official docs",
    file: "src/lib/roblox-knowledge.ts",
    must: [/roblox_docs_search/, /DataStores/, /Remote/, /MarketplaceService/],
  },
];

let failed = 0;

for (const check of checks) {
  const text = read(check.file);
  const missing = check.must.filter((pattern) => !pattern.test(text));
  if (missing.length) {
    failed += 1;
    console.error(`FAIL ${check.name}`);
    console.error(`  ${check.file}`);
    console.error(`  Missing: ${missing.map(String).join(", ")}`);
  } else {
    console.log(`PASS ${check.name}`);
  }
}

const evalCases = [
  {
    prompt: "Fix my DataStore save script",
    expected: ["pcall", "UpdateAsync", "server"],
  },
  {
    prompt: "Make a sword combat system with RemoteEvents",
    expected: ["RemoteEvent", "server validation", "cooldown"],
  },
  {
    prompt: "Add a shop GUI for mobile",
    expected: ["StarterGui", "LocalScript", "mobile"],
  },
  {
    prompt: "Use a free Roblox model for a lobby map",
    expected: ["assetId", "scan", "unsafe scripts"],
  },
];

console.log(`\nAI eval prompt set: ${evalCases.length} Roblox reliability cases`);
for (const item of evalCases) {
  console.log(`- ${item.prompt} -> ${item.expected.join(", ")}`);
}

if (failed) {
  process.exitCode = 1;
}
