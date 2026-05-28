import { createFileRoute } from "@tanstack/react-router";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

type GenFile = {
  path: string;
  file_type: string;
  service_location: string;
  content: string;
};

type GenAction = {
  type: string;
  parent?: string;
  name?: string;
  className?: string;
  properties?: Record<string, unknown>;
  [key: string]: unknown;
};

function cleanPrompt(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 4000) : "";
}

function scriptFile(path: string, service: string, content: string): GenFile {
  return { path, file_type: "Script", service_location: service, content };
}

function makeLeaderstatsScript(): GenFile {
  return scriptFile(
    "ServerScriptService/BloxSmith/Leaderstats.server.lua",
    "ServerScriptService",
    `local Players = game:GetService("Players")

Players.PlayerAdded:Connect(function(player)
    local leaderstats = Instance.new("Folder")
    leaderstats.Name = "leaderstats"
    leaderstats.Parent = player

    local cash = Instance.new("IntValue")
    cash.Name = "Cash"
    cash.Value = 0
    cash.Parent = leaderstats
end)
`,
  );
}

function makeTycoonControllerScript(): GenFile {
  return scriptFile(
    "ServerScriptService/BloxSmith/TycoonController.server.lua",
    "ServerScriptService",
    `local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")

local function getCash(player)
    local leaderstats = player:FindFirstChild("leaderstats")
    return leaderstats and leaderstats:FindFirstChild("Cash")
end

local function hookCollector(part)
    part.Touched:Connect(function(hit)
        local character = hit.Parent
        local player = character and Players:GetPlayerFromCharacter(character)
        if not player then return end
        local cash = getCash(player)
        if cash then
            cash.Value += 25
        end
    end)
end

for _, part in ipairs(CollectionService:GetTagged("BloxSmithCollector")) do
    if part:IsA("BasePart") then hookCollector(part) end
end

CollectionService:GetInstanceAddedSignal("BloxSmithCollector"):Connect(function(part)
    if part:IsA("BasePart") then hookCollector(part) end
end)
`,
  );
}

function basicWorkspaceActions(prompt: string): GenAction[] {
  const lower = prompt.toLowerCase();
  const wantsTycoon = /tycoon|cash|dropper|conveyor|collector|owner/.test(lower);
  const wantsObby = /obby|checkpoint|kill brick|stage/.test(lower);
  const wantsMap = /map|city|forest|lobby|world|horror|school|restaurant|simulator/.test(lower);

  if (wantsTycoon) {
    return [
      {
        type: "create_folder",
        parent: "Workspace",
        name: "BloxSmithTycoon",
      },
      {
        type: "create_part",
        parent: "Workspace/BloxSmithTycoon",
        name: "TycoonBase",
        properties: { Size: [90, 2, 90], Position: [0, 0, 0], Color: [60, 180, 90], Anchored: true },
      },
      {
        type: "create_part",
        parent: "Workspace/BloxSmithTycoon",
        name: "OwnerDoor",
        properties: { Size: [10, 14, 1], Position: [-35, 7, -35], Color: [0, 255, 255], Transparency: 0.25, Anchored: true },
      },
      {
        type: "create_part",
        parent: "Workspace/BloxSmithTycoon",
        name: "Conveyor",
        properties: { Size: [8, 1, 45], Position: [0, 2, 0], Color: [35, 35, 45], Anchored: true },
      },
      {
        type: "create_part",
        parent: "Workspace/BloxSmithTycoon",
        name: "Collector",
        properties: { Size: [14, 2, 8], Position: [0, 3, 28], Color: [0, 255, 90], Anchored: true, Tags: ["BloxSmithCollector"] },
      },
      {
        type: "create_part",
        parent: "Workspace/BloxSmithTycoon",
        name: "BuyDropperButton",
        properties: { Size: [8, 1, 8], Position: [-18, 2, -18], Color: [255, 210, 0], Anchored: true },
      },
      {
        type: "create_part",
        parent: "Workspace/BloxSmithTycoon",
        name: "DropperModelPlaceholder",
        properties: { Size: [8, 10, 8], Position: [0, 7, -25], Color: [120, 120, 130], Anchored: true },
      },
    ];
  }

  if (wantsObby) {
    return [
      { type: "create_folder", parent: "Workspace", name: "BloxSmithObby" },
      { type: "create_part", parent: "Workspace/BloxSmithObby", name: "Start", properties: { Size: [18, 1, 18], Position: [0, 1, 0], Color: [0, 255, 100], Anchored: true } },
      { type: "create_part", parent: "Workspace/BloxSmithObby", name: "Checkpoint1", properties: { Size: [14, 1, 14], Position: [0, 5, -35], Color: [0, 170, 255], Anchored: true } },
      { type: "create_part", parent: "Workspace/BloxSmithObby", name: "KillBrick", properties: { Size: [20, 1, 20], Position: [0, 2, -18], Color: [255, 0, 0], Anchored: true } },
      { type: "create_part", parent: "Workspace/BloxSmithObby", name: "Winner", properties: { Size: [20, 1, 20], Position: [0, 8, -70], Color: [255, 220, 0], Anchored: true } },
    ];
  }

  if (wantsMap) {
    return [
      { type: "create_folder", parent: "Workspace", name: "BloxSmithMap" },
      { type: "create_part", parent: "Workspace/BloxSmithMap", name: "MainGround", properties: { Size: [140, 2, 140], Position: [0, 0, 0], Color: [90, 170, 90], Anchored: true } },
      { type: "create_part", parent: "Workspace/BloxSmithMap", name: "SpawnPlatform", properties: { Size: [20, 1, 20], Position: [0, 3, 0], Color: [0, 255, 180], Anchored: true } },
      { type: "create_part", parent: "Workspace/BloxSmithMap", name: "FeatureBuilding", properties: { Size: [28, 24, 28], Position: [35, 13, 35], Color: [80, 90, 120], Anchored: true } },
    ];
  }

  return [
    { type: "create_folder", parent: "Workspace", name: "BloxSmithBuild" },
    { type: "create_part", parent: "Workspace/BloxSmithBuild", name: "GeneratedBase", properties: { Size: [60, 2, 60], Position: [0, 0, 0], Color: [80, 180, 120], Anchored: true } },
  ];
}

function buildFallbackResult(prompt: string) {
  const lower = prompt.toLowerCase();
  const files: GenFile[] = [];

  if (/cash|leaderstats|tycoon|simulator|coin|money/.test(lower)) {
    files.push(makeLeaderstatsScript());
  }
  if (/tycoon|collector|dropper|conveyor/.test(lower)) {
    files.push(makeTycoonControllerScript());
  }

  const actions = basicWorkspaceActions(prompt);
  const autoExecute = true;

  return {
    message:
      "BloxSmith queued a safe Studio build so the page and plugin can keep working. For bigger real-asset builds, make sure your AI gateway and Roblox asset search keys are configured, then Sync again.",
    files,
    actions,
    autoExecute,
    chargedCredits: 0,
    model: "safe-fallback",
  };
}

export const Route = createFileRoute("/api/assistant/execute")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        try {
          const body = await request.json().catch(() => ({}));
          const prompt = cleanPrompt(body?.prompt ?? body?.message ?? body?.input);

          if (!prompt) {
            return new Response(
              JSON.stringify({ error: "missing_prompt", message: "Please type what you want BloxSmith to build." }),
              { status: 400, headers: corsHeaders },
            );
          }

          return new Response(JSON.stringify(buildFallbackResult(prompt)), {
            status: 200,
            headers: corsHeaders,
          });
        } catch (error: any) {
          console.error("assistant execute safe route failed", error?.message ?? error);
          return new Response(
            JSON.stringify({
              message: "BloxSmith recovered from an assistant error. Try again or refresh the project.",
              files: [],
              actions: [],
              chargedCredits: 0,
              model: "safe-error-fallback",
            }),
            { status: 200, headers: corsHeaders },
          );
        }
      },
    },
  },
});
