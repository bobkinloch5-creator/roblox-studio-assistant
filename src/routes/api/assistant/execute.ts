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

function scriptFile(path: string, service: string, content: string, fileType = "Script"): GenFile {
  return { path, file_type: fileType, service_location: service, content };
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

function makeLoadingScreenScript(): GenFile {
  return scriptFile(
    "StarterGui/BloxSmithLoadingScreen/LoadingScreen.client.lua",
    "StarterGui",
    `local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local ReplicatedFirst = game:GetService("ReplicatedFirst")

ReplicatedFirst:RemoveDefaultLoadingScreen()

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local gui = Instance.new("ScreenGui")
gui.Name = "BloxSmithLoadingScreen"
gui.IgnoreGuiInset = true
gui.ResetOnSpawn = false
gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
gui.DisplayOrder = 999999
gui.Parent = playerGui

local background = Instance.new("Frame")
background.Name = "Background"
background.Size = UDim2.fromScale(1, 1)
background.BackgroundColor3 = Color3.fromRGB(5, 8, 18)
background.BorderSizePixel = 0
background.Parent = gui

local gradient = Instance.new("UIGradient")
gradient.Color = ColorSequence.new({
    ColorSequenceKeypoint.new(0, Color3.fromRGB(15, 255, 175)),
    ColorSequenceKeypoint.new(0.45, Color3.fromRGB(20, 35, 70)),
    ColorSequenceKeypoint.new(1, Color3.fromRGB(255, 135, 20)),
})
gradient.Rotation = 35
gradient.Parent = background

local dim = Instance.new("Frame")
dim.Name = "Dim"
dim.Size = UDim2.fromScale(1, 1)
dim.BackgroundColor3 = Color3.fromRGB(0, 0, 0)
dim.BackgroundTransparency = 0.35
dim.BorderSizePixel = 0
dim.Parent = background

local card = Instance.new("Frame")
card.Name = "LoadingCard"
card.AnchorPoint = Vector2.new(0.5, 0.5)
card.Position = UDim2.fromScale(0.5, 0.5)
card.Size = UDim2.fromScale(0.72, 0.28)
card.BackgroundColor3 = Color3.fromRGB(10, 18, 30)
card.BackgroundTransparency = 0.1
card.BorderSizePixel = 0
card.Parent = background

local sizeLimit = Instance.new("UISizeConstraint")
sizeLimit.MinSize = Vector2.new(260, 170)
sizeLimit.MaxSize = Vector2.new(640, 260)
sizeLimit.Parent = card

local corner = Instance.new("UICorner")
corner.CornerRadius = UDim.new(0, 22)
corner.Parent = card

local stroke = Instance.new("UIStroke")
stroke.Color = Color3.fromRGB(52, 255, 177)
stroke.Thickness = 1.5
stroke.Transparency = 0.2
stroke.Parent = card

local title = Instance.new("TextLabel")
title.Name = "Title"
title.BackgroundTransparency = 1
title.Position = UDim2.fromScale(0.08, 0.16)
title.Size = UDim2.fromScale(0.84, 0.22)
title.Font = Enum.Font.GothamBold
title.Text = "Loading Your Roblox Adventure"
title.TextColor3 = Color3.fromRGB(255, 255, 255)
title.TextScaled = true
title.Parent = card

local status = Instance.new("TextLabel")
status.Name = "Status"
status.BackgroundTransparency = 1
status.Position = UDim2.fromScale(0.08, 0.44)
status.Size = UDim2.fromScale(0.84, 0.14)
status.Font = Enum.Font.GothamMedium
status.Text = "Preparing assets..."
status.TextColor3 = Color3.fromRGB(190, 220, 220)
status.TextScaled = true
status.Parent = card

local barBack = Instance.new("Frame")
barBack.Name = "ProgressBack"
barBack.Position = UDim2.fromScale(0.08, 0.68)
barBack.Size = UDim2.fromScale(0.84, 0.08)
barBack.BackgroundColor3 = Color3.fromRGB(25, 35, 48)
barBack.BorderSizePixel = 0
barBack.Parent = card

local barCorner = Instance.new("UICorner")
barCorner.CornerRadius = UDim.new(1, 0)
barCorner.Parent = barBack

local bar = Instance.new("Frame")
bar.Name = "ProgressFill"
bar.Size = UDim2.fromScale(0, 1)
bar.BackgroundColor3 = Color3.fromRGB(52, 255, 177)
bar.BorderSizePixel = 0
bar.Parent = barBack

local fillCorner = Instance.new("UICorner")
fillCorner.CornerRadius = UDim.new(1, 0)
fillCorner.Parent = bar

local messages = {
    "Preparing assets...",
    "Building your world...",
    "Loading scripts...",
    "Polishing UI...",
    "Almost ready...",
}

for i, text in ipairs(messages) do
    status.Text = text
    TweenService:Create(bar, TweenInfo.new(0.45, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
        Size = UDim2.fromScale(i / #messages, 1),
    }):Play()
    task.wait(0.55)
end

TweenService:Create(background, TweenInfo.new(0.45), { BackgroundTransparency = 1 }):Play()
TweenService:Create(card, TweenInfo.new(0.35), { BackgroundTransparency = 1 }):Play()
task.wait(0.5)
gui:Destroy()
`,
    "LocalScript",
  );
}

function loadingScreenActions(): GenAction[] {
  return [
    { type: "create_folder", parent: "StarterGui", name: "BloxSmithLoadingScreen" },
    {
      type: "script",
      parent: "StarterGui/BloxSmithLoadingScreen",
      name: "LoadingScreen.client.lua",
      className: "LocalScript",
      source: makeLoadingScreenScript().content,
    },
  ];
}

function basicWorkspaceActions(prompt: string): GenAction[] {
  const lower = prompt.toLowerCase();
  const wantsTycoon = /tycoon|cash|dropper|conveyor|collector|owner/.test(lower);
  const wantsObby = /obby|checkpoint|kill brick|stage/.test(lower);
  const wantsMap = /map|city|forest|lobby|world|horror|school|restaurant|simulator/.test(lower);
  const wantsLoading = /loading|load screen|loading screen|splash screen|start screen/.test(lower);

  if (wantsLoading) return loadingScreenActions();

  if (wantsTycoon) {
    return [
      { type: "create_folder", parent: "Workspace", name: "BloxSmithTycoon" },
      { type: "create_part", parent: "Workspace/BloxSmithTycoon", name: "TycoonBase", properties: { Size: [90, 2, 90], Position: [0, 0, 0], Color: [60, 180, 90], Anchored: true } },
      { type: "create_part", parent: "Workspace/BloxSmithTycoon", name: "OwnerDoor", properties: { Size: [10, 14, 1], Position: [-35, 7, -35], Color: [0, 255, 255], Transparency: 0.25, Anchored: true } },
      { type: "create_part", parent: "Workspace/BloxSmithTycoon", name: "Conveyor", properties: { Size: [8, 1, 45], Position: [0, 2, 0], Color: [35, 35, 45], Anchored: true } },
      { type: "create_part", parent: "Workspace/BloxSmithTycoon", name: "Collector", properties: { Size: [14, 2, 8], Position: [0, 3, 28], Color: [0, 255, 90], Anchored: true, Tags: ["BloxSmithCollector"] } },
      { type: "create_part", parent: "Workspace/BloxSmithTycoon", name: "BuyDropperButton", properties: { Size: [8, 1, 8], Position: [-18, 2, -18], Color: [255, 210, 0], Anchored: true } },
      { type: "create_part", parent: "Workspace/BloxSmithTycoon", name: "DropperModelPlaceholder", properties: { Size: [8, 10, 8], Position: [0, 7, -25], Color: [120, 120, 130], Anchored: true } },
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
  let message = "Prepared a Studio-ready starter build and queued it for the Roblox plugin.";

  if (/loading|load screen|loading screen|splash screen|start screen/.test(lower)) {
    files.push(makeLoadingScreenScript());
    message = "Prepared a premium Roblox loading screen with animated progress, gradient background, mobile-friendly scaling, and a LocalScript under StarterGui/BloxSmithLoadingScreen.";
  }

  if (/cash|leaderstats|tycoon|simulator|coin|money/.test(lower)) {
    files.push(makeLeaderstatsScript());
    message = "Prepared leaderstats/currency support and queued it for Studio.";
  }
  if (/tycoon|collector|dropper|conveyor/.test(lower)) {
    files.push(makeTycoonControllerScript());
    message = "Prepared a starter tycoon system with a base, collector, conveyor, and server script.";
  }

  const actions = basicWorkspaceActions(prompt);
  const autoExecute = true;

  return {
    message,
    files,
    actions,
    autoExecute,
    queuedCount: files.length + actions.length,
    chargedCredits: 0,
    model: "safe-fallback-builder",
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
              queuedCount: 0,
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