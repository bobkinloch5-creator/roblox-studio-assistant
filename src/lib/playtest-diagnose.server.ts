import { resolveBuiltInGateway } from "./ai-providers.server";

export type Severity = "error" | "warning" | "info";
export type FindingKind =
  | "missing_remote"
  | "script_placement"
  | "data_save"
  | "broken_ui"
  | "missing_folder"
  | "broken_button"
  | "syntax"
  | "runtime_error"
  | "other";

export type Finding = {
  id: string;
  severity: Severity;
  kind: FindingKind;
  title: string;
  detail: string;
  target: string; // Studio path the problem relates to
};

export type PlanStep = {
  id: string;
  title: string;
  detail: string;
  target: string;
  actionType: string; // a plugin action type: script / create / set / move / ...
};

export type PlaytestPlan = {
  summary: string;
  steps: PlanStep[];
};

export type ProjectFile = {
  path: string;
  file_type: string;
  service_location: string;
  content: string;
};

export type StudioError = { file_path: string | null; error_message: string };

let counter = 0;
const nid = (p: string) => `${p}_${Date.now().toString(36)}_${(counter++).toString(36)}`;

/**
 * Fast, deterministic heuristics over the synced project files + captured
 * Studio Output errors. These run with zero AI cost and catch the most common
 * Roblox mistakes the user named (missing RemoteEvents, bad script placement,
 * no DataStore saving, broken UI references, syntax issues). The AI step then
 * turns these + the user's request into a clear, human plan.
 */
export function runHeuristics(files: ProjectFile[], errors: StudioError[]): Finding[] {
  const found: Finding[] = [];
  const byPath = new Map(files.map((f) => [f.path, f]));
  const allSource = files.map((f) => f.content || "").join("\n");

  const isScript = (f: ProjectFile) =>
    /Script$/.test(f.file_type) || ["Script", "LocalScript", "ModuleScript"].includes(f.file_type);

  // 1) Runtime errors captured from the Studio Output window.
  for (const e of errors.slice(0, 25)) {
    found.push({
      id: nid("err"),
      severity: "error",
      kind: "runtime_error",
      title: "Runtime error in Output",
      detail: e.error_message.slice(0, 300),
      target: e.file_path || "Output",
    });
  }

  for (const f of files) {
    const src = f.content || "";
    if (!isScript(f)) continue;

    // 2) RemoteEvent referenced but never created anywhere in the project.
    const remoteRefs = [...src.matchAll(/(?:WaitForChild|FindFirstChild)\(\s*["']([A-Za-z0-9_]+)["']\s*\)/g)]
      .map((m) => m[1])
      .filter((name) => /remote|event|rf|re_|fire|invoke/i.test(name) || src.includes(`${name}:FireServer`) || src.includes(`${name}:FireClient`));
    for (const name of new Set(remoteRefs)) {
      const createdSomewhere =
        new RegExp(`Instance\\.new\\(\\s*["']Remote(?:Event|Function)["']`).test(allSource) &&
        allSource.includes(name);
      const existsAsFile = files.some(
        (o) => /Remote(Event|Function)/.test(o.file_type) && o.path.endsWith(name),
      );
      if (!createdSomewhere && !existsAsFile) {
        found.push({
          id: nid("rem"),
          severity: "error",
          kind: "missing_remote",
          title: `Missing RemoteEvent: ${name}`,
          detail: `${f.path} calls "${name}" but no RemoteEvent/RemoteFunction named "${name}" is created or present. Client/server messaging will error.`,
          target: `ReplicatedStorage/${name}`,
        });
      }
    }

    // 3) Script placement: server APIs used inside a LocalScript or vice versa.
    if (f.file_type === "LocalScript" && /DataStoreService|:GetDataStore\(/.test(src)) {
      found.push({
        id: nid("place"),
        severity: "error",
        kind: "script_placement",
        title: "DataStore used in a LocalScript",
        detail: `${f.path} uses DataStoreService, which only works on the server. It must be a Script in ServerScriptService.`,
        target: f.path,
      });
    }
    if (
      f.file_type === "Script" &&
      /:GetMouse\(\)|UserInputService|game\.Players\.LocalPlayer/.test(src) &&
      !/RunService:IsClient/.test(src)
    ) {
      found.push({
        id: nid("place"),
        severity: "warning",
        kind: "script_placement",
        title: "Client API used in a server Script",
        detail: `${f.path} references LocalPlayer / input APIs from a server Script. These run on the client only — this likely belongs in a LocalScript.`,
        target: f.path,
      });
    }

    // 4) Saving issues: DataStore get without any set/update (reads but never saves).
    if (/:GetDataStore\(/.test(src)) {
      const reads = /:GetAsync\(/.test(src);
      const writes = /:SetAsync\(|:UpdateAsync\(|:IncrementAsync\(/.test(src);
      if (reads && !writes) {
        found.push({
          id: nid("save"),
          severity: "error",
          kind: "data_save",
          title: "Data loads but never saves",
          detail: `${f.path} reads from a DataStore (GetAsync) but never writes (SetAsync/UpdateAsync). Player progress (coins, stats) won't persist.`,
          target: f.path,
        });
      }
      if (writes && !/BindToClose/.test(allSource)) {
        found.push({
          id: nid("save"),
          severity: "warning",
          kind: "data_save",
          title: "No save on game close",
          detail: `Saving exists but there's no game:BindToClose handler, so data can be lost when the server shuts down.`,
          target: f.path,
        });
      }
    }

    // 5) Syntax red flags (cheap checks; the plugin/Studio is the source of truth).
    const opens = (src.match(/\b(function|if|for|while|do)\b/g) || []).length;
    const ends = (src.match(/\bend\b/g) || []).length;
    if (opens > 0 && ends < opens - 1) {
      found.push({
        id: nid("syn"),
        severity: "warning",
        kind: "syntax",
        title: "Possibly missing 'end'",
        detail: `${f.path} has ${opens} block openers but only ${ends} 'end' keywords — it may not compile.`,
        target: f.path,
      });
    }
  }

  // 6) Broken UI: a TextButton/ImageButton with no .Activated/.MouseButton1Click handler anywhere.
  const buttons = files.filter((f) => /TextButton|ImageButton/.test(f.file_type));
  for (const b of buttons) {
    const name = b.path.split("/").pop() || b.path;
    const wired = new RegExp(`${name}[^\\n]*(Activated|MouseButton1Click|MouseButton1Down)`).test(allSource) ||
      allSource.includes(`${name}.Activated`);
    if (!wired) {
      found.push({
        id: nid("btn"),
        severity: "warning",
        kind: "broken_button",
        title: `Button not wired: ${name}`,
        detail: `${b.path} is a clickable button but nothing connects to its Activated/MouseButton1Click event, so clicking it does nothing.`,
        target: b.path,
      });
    }
  }

  // 7) Missing common folders the project's scripts assume.
  const needsReplicatedStorage = /ReplicatedStorage[:.]/.test(allSource);
  const hasReplicatedStorageFolder = files.some((f) => f.service_location === "ReplicatedStorage");
  if (needsReplicatedStorage && !hasReplicatedStorageFolder) {
    found.push({
      id: nid("fold"),
      severity: "warning",
      kind: "missing_folder",
      title: "ReplicatedStorage looks empty",
      detail: `Scripts reference ReplicatedStorage but nothing is stored there. Shared modules/remotes may be missing.`,
      target: "ReplicatedStorage",
    });
  }

  return found;
}

/**
 * Convert approved plan steps into concrete, ready-to-apply plugin actions
 * (with real Luau source, instance names, parents, etc.). Returns an array of
 * plugin action objects the Studio plugin understands. Falls back to safe,
 * minimal actions if the AI is unavailable.
 */
export async function buildActionsForSteps(opts: {
  request: string;
  steps: PlanStep[];
  files: ProjectFile[];
}): Promise<any[]> {
  try {
    const gw = resolveBuiltInGateway({ kind: "build", thinking: true });
    const { generateText } = await import("ai");
    const fileIndex = opts.files.map((f) => ({
      path: f.path,
      file_type: f.file_type,
      service_location: f.service_location,
    }));
    const sys =
      "You are BloxSmith Playtest AI. Convert approved fix steps into concrete Roblox Studio plugin actions. " +
      "Output ONLY a JSON array of actions. Each action is one of:\n" +
      '{"type":"script","path":"ServerScriptService/Name","source":"<luau>"}\n' +
      '{"type":"create","className":"RemoteEvent","name":"Buy","parent":"ReplicatedStorage"}\n' +
      '{"type":"create","className":"Folder","name":"Remotes","parent":"ReplicatedStorage"}\n' +
      '{"type":"move","path":"StarterGui/Handler","to":"ServerScriptService"}\n' +
      '{"type":"set","path":"...","property":"...","value":...}\n' +
      "Use valid Roblox service paths and syntactically valid Luau. Keep changes minimal and focused on the steps. No prose, no markdown.";
    const user = `USER REQUEST: ${opts.request}\n\nAPPROVED STEPS:\n${JSON.stringify(opts.steps, null, 0)}\n\nFILE INDEX:\n${JSON.stringify(fileIndex.slice(0, 120), null, 0)}`;
    const { text } = await generateText({
      model: gw.model,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
    });
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
        .filter((a) => a && typeof a.type === "string")
        .slice(0, 40);
    }
  } catch {
    // fall through to deterministic minimal actions
  }
  // Deterministic fallback: create missing remotes / folders named in targets.
  return opts.steps
    .map((s) => {
      if (s.actionType === "create" && s.target) {
        const parts = s.target.split("/");
        const name = parts.pop() || "New";
        const parent = parts.join("/") || "ReplicatedStorage";
        return { type: "create", className: "RemoteEvent", name, parent };
      }
      return null;
    })
    .filter(Boolean) as any[];
}

/**
 * Ask the model to (a) interpret the user's plain-language request, (b) prioritise
 * the heuristic findings against it, and (c) produce a short, human plan. Returns
 * a structured plan; falls back to a deterministic plan if the AI is unavailable.
 */
export async function synthesizePlan(opts: {
  request: string;
  findings: Finding[];
  fileIndex: { path: string; file_type: string }[];
}): Promise<PlaytestPlan> {
  const fallback: PlaytestPlan = {
    summary:
      opts.findings.length > 0
        ? `Found ${opts.findings.length} issue(s). Proposed fixes are listed below.`
        : "No obvious problems found in the current scan.",
    steps: opts.findings.slice(0, 8).map((f) => ({
      id: f.id,
      title: f.title,
      detail: f.detail,
      target: f.target,
      actionType:
        f.kind === "missing_remote"
          ? "create"
          : f.kind === "script_placement"
            ? "move"
            : "script",
    })),
  };

  try {
    const gw = resolveBuiltInGateway({ kind: "build", thinking: true });
    const { generateText } = await import("ai");
    const sys =
      "You are BloxSmith Playtest AI, a Roblox QA developer. You receive a user's plain-language request, a list of detected issues, and a file index. " +
      "Interpret what the user actually wants, choose the issues that matter for that request, and output a SHORT fix plan. " +
      "Respond with ONLY JSON: {\"summary\":string,\"steps\":[{\"id\":string,\"title\":string,\"detail\":string,\"target\":string,\"actionType\":string}]}. " +
      "actionType must be one of: script, update_script, create, create_part, set, move, rename, organize. No prose, no markdown.";
    const user = `USER REQUEST: ${opts.request || "(general health check)"}\n\nDETECTED ISSUES:\n${JSON.stringify(opts.findings, null, 0)}\n\nFILE INDEX:\n${JSON.stringify(opts.fileIndex.slice(0, 120), null, 0)}`;
    const { text } = await generateText({
      model: gw.model,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
    });
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    if (parsed && Array.isArray(parsed.steps)) {
      return {
        summary: String(parsed.summary || fallback.summary),
        steps: parsed.steps.slice(0, 12).map((s: any, i: number) => ({
          id: String(s.id || `step_${i}`),
          title: String(s.title || "Fix"),
          detail: String(s.detail || ""),
          target: String(s.target || ""),
          actionType: String(s.actionType || "script"),
        })),
      };
    }
  } catch {
    // AI unavailable or returned non-JSON — deterministic plan is fine.
  }
  return fallback;
}
