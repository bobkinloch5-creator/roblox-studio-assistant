# Smartest AI Builder Upgrade for BloxSmith

This document defines the product and engineering standard for making BloxSmith feel like the smartest Roblox AI builder available.

## Goal

BloxSmith should not behave like a normal chat bot. It should behave like a senior Roblox developer inside the user's project. It should plan, generate, insert, test, validate, fix, and remember.

## Core user promise

> Tell BloxSmith what you want. It builds real Roblox Studio-ready systems: maps, scripts, GUIs, assets, remotes, saving, shops, NPCs, and full playable game loops.

## Required AI workflow

Every actionable request should follow this internal flow:

1. **Understand** the user request, including typos, slang, short prompts, and vague wording.
2. **Scan** live Studio context, saved project files, memory, previous generations, and known errors.
3. **Classify** the request as BUILD, EDIT, FIX, POLISH, ASSET, QUESTION, MCP, or BILLING.
4. **Plan** the Roblox service layout.
5. **Generate** Studio-ready files and plugin actions.
6. **Validate** safety, path placement, server/client trust boundaries, Remotes, DataStores, and mobile UI.
7. **Queue** actions for the plugin.
8. **Remember** what was built so future requests continue correctly.
9. **Report** exactly what was prepared without pretending the plugin already applied it.

## Must-have intelligence features

### 1. Project scanner awareness

The AI must use the live Studio context and project file map before making changes. It should know what already exists and avoid duplicate systems.

### 2. Real edit-mode insertion

Generated objects must appear in Roblox Studio edit mode, not only during Play mode. World objects belong under `Workspace`. GUIs belong in `StarterGui`. Scripts must be placed in the correct service.

### 3. Auto-fix behavior

When a user pastes an error, the AI should patch the likely script and add guards, instead of only explaining the error.

### 4. Full game templates

A full-game request should generate a playable starter stack:

- Map/lobby
- Core loop
- Currency/progression
- Leaderstats
- Save system
- Shop/upgrades
- UI/HUD
- Remotes
- Mobile support
- Publish checklist

### 5. Roblox safety

The AI must block dangerous patterns:

- `loadstring`
- suspicious `require(assetId)`
- hidden backdoor scripts
- unexpected `HttpService` calls
- obfuscated script payloads
- client-trusted currency/rewards/damage

### 6. Better responses

The AI should say:

> Prepared the mining simulator system and queued the map, scripts, HUD, remotes, and save logic for Studio.

It should not say:

> Done, I created it.

unless the plugin already confirmed the actions were applied.

## Recommended route integration

Import the core prompt into the existing AI gateway/system prompt:

```ts
import { SMART_BUILDER_SYSTEM_UPGRADE } from "./ai-smartest-builder-core";
```

Then append it near the top of the system prompt so every AI route gets the same rules.

## Recommended eval checks

The AI should be tested against these prompts:

1. `make me a mining simulator with pets, backpacks, ores, rebirths and a shop`
2. `fix my datastore not saving`
3. `make the UI premium and animated for mobile`
4. `add a sword combat system with remotes and cooldowns`
5. `insert a free lobby map and make sure no unsafe scripts are inside`
6. `make a horror game flashlight, chase NPC, scary lighting and doors`
7. `my RemoteEvent gives coins but exploiters can spam it fix it`
8. `make everything look better`

A good answer must queue files/actions, use correct Roblox service locations, validate server/client boundaries, and avoid fake success claims.

## Product features to prioritize next

1. Plugin confirmation messages back to the website.
2. Undo/rollback for last generation.
3. Visual action preview before pushing to Studio.
4. Project scan panel showing scripts, GUIs, Remotes, missing objects, and likely errors.
5. Template picker for Mining Simulator, Tycoon, Obby, Horror, RPG, Pet Simulator, Tower Defense, and Roleplay City.
6. Asset safety scanner for toolbox imports.
7. AI memory viewer so owners can see what the AI remembers per project.
8. One-click publish checklist.

## Definition of "smartest"

BloxSmith is smarter when it:

- understands messy human requests,
- builds instead of lectures,
- places things correctly,
- fixes its own mistakes,
- remembers the project,
- keeps games safe from exploiters,
- makes UI mobile-friendly,
- and proves what it queued.
