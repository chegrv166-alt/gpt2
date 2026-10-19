# Blood and Walk Animations Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task. All implementation steps use TDD.

**Goal:** Add true walk cycles for all four actors plus room-scoped 18+ blood effects, persistent enemy corpses/pools, and fading footprints.

**Architecture:** Keep combat decisions in the Phaser-independent models and send typed damage/death events to a disposable Phaser presentation system. Bake normalized painted walk strips into the existing actor texture key pattern, with a dedicated six-frame walk count and the existing four-frame count for other states.

**Tech Stack:** TypeScript strict, Phaser 3, Vite, Playwright, local PNG sprite sheets, `Graphics.generateTexture` effects.

**Spec:** `docs/superpowers/specs/2026-10-19-blood-and-walk-animations-design.md`

## Global Constraints

- Keep eight gameplay directions mapped to the existing four painted views.
- Keep `FRAME_COUNT = 4` for idle, attack, hurt, and all non-walk assets; define `WALK_FRAME_COUNT = 6` for walk assets only.
- Blood, corpses, and prints are cosmetic; they never alter collision, damage, AI, or stats.
- Corpses and pools live until room unload/restart; prints fade; run reset clears the room effects.
- Generate effect textures locally during boot. All art and runtime content remain offline-capable.
- Respect actor foot anchors, sort by ground depth, keep combat telegraphs/HUD readable, and dispose scene-owned objects on shutdown.

## Review Focus

- Actor is hurt, dead, or attacking while moving: walk playback must stop and the higher-priority state must remain visible.
- A single death event is delivered twice or an encounter resets: corpses and pools must not duplicate, and reset must clear the old state.
- Hero or multiple enemies walk through the same pool in one update: each actor gets independent, correctly oriented prints without a burst of duplicates.
- A blood effect appears beneath the room multiply layer and is still readable in both rooms.
- Repeated scene shutdown/restart must not accumulate event listeners, tweens, blood sprites, or texture keys.

---

### Task 1: Real walk cycle asset pipeline

**Files:**
- Create: `src/assets/art/walk/hero.png`, `grunt.png`, `caster.png`, `boss.png` (packed normalized sheets, six frames across and four authored view rows).
- Modify: `src/assets/catalog.ts`, `src/assets/PaintedTextures.ts`, `src/scenes/BootScene.ts`.
- Test: `tests/boot.spec.ts`, `tests/art-game.spec.ts`.

**Interfaces:**
- Add `WALK_FRAME_COUNT = 6` beside `FRAME_COUNT`.
- Preserve `actorTextureKey(actor, state, direction, frame)` and every existing animation key.
- Add local Vite imports for four packed walk sheets; each sheet row is authored in `se`, `s`, `w`, `n` order to match the existing direction-column map.

- [x] Write a failing asset-catalog test asserting six walk texture specs per actor/direction and four for each other state.
- [x] Run the targeted boot test and confirm the current four-frame walk contract fails it.
- [x] Generate one six-frame transparent strip per actor/view from the approved painted source pose; normalize fixed frame size and bottom-center anchor; pack each actor's four strips into the declared row order. Inspect each strip at game scale.
- [x] Load and bake walk sheets in `PaintedTextures`; keep other painted-state generation and stable animation names unchanged.
- [x] Update the browser animation test to prove the walk frame changes over time while moving and remains centered on the foot anchor in all source views.
- [x] Run `CHROMIUM_PATH=/usr/bin/chromium npx playwright test tests/boot.spec.ts tests/art-game.spec.ts` and confirm the new tests pass.
- [x] Commit as `feat: add painted walk cycles for all actors`.

### Task 2: Blood field model and combat events

**Files:**
- Create: `src/blood/BloodField.ts`.
- Modify: `src/combat/definitions.ts`, `src/combat/CombatWorld.ts`.
- Test: `tests/blood.spec.ts`, `tests/combat.spec.ts`.

**Interfaces:**
- `BloodField.addCorpse(actorId: number, kind: EnemyKind, position: Vec2, direction: Direction): boolean` records an idempotent corpse and its nearby pool.
- `BloodField.addImpact(position: Vec2, intensity: number): BloodImpact` creates bounded cosmetic impact data.
- `BloodField.sampleActor(actorId: number, position: Vec2, seconds: number): BloodFootprint[]` emits prints only for movement through a pool.
- `BloodField.update(seconds: number): void` expires prints; `clear(): void` clears corpses, pools, footprints, and counters.
- Extend death events with the actor facing direction; damage events retain target ground position and target team.

- [x] Add pure tests for idempotent corpses/pools, independent actor sampling, distance-based prints inside pools only, expiry, and clear.
- [x] Run `CHROMIUM_PATH=/usr/bin/chromium npx playwright test tests/blood.spec.ts tests/combat.spec.ts` and confirm the missing model/event behavior fails.
- [x] Implement deterministic, bounded ground-space blood data. Keep all values presentation-only.
- [x] Assert enemy death events include the facing direction and duplicate combat delivery still emits only one death.
- [x] Re-run the targeted tests and confirm pass.
- [x] Commit as `feat: model room blood and actor footprints`.

### Task 3: Blood and corpse presentation

**Files:**
- Create: `src/blood/RoomBloodView.ts`.
- Modify: `src/scenes/BootScene.ts`, `src/scenes/GameScene.ts`, `src/views/CombatView.ts`, `src/views/EnemyView.ts`.
- Test: `tests/blood-game.spec.ts`, `tests/combat-game.spec.ts`, `tests/rooms-game.spec.ts`.

**Interfaces:**
- `RoomBloodView(scene: Phaser.Scene, arena: ArenaRenderer, field: BloodField, battle: CombatWorld)` owns Phaser images/tweens and exposes `render(seconds: number, events: readonly CombatEvent[]): void`, `clear(): void`, and `destroy(): void`.
- `GameScene` owns one view per room and sends each drained event once.

- [x] Add browser coverage for damage/death events: impact blood is visible, a killed enemy leaves a stable corpse plus pool, an actor crossing it creates fading prints, and reset/restart clears room-owned effects.
- [x] Run the targeted browser tests and confirm they fail because no persistent blood view exists.
- [x] Generate cached transparent blood-spray, pool, and footprint textures in `BootScene` using `Graphics`.
- [x] Render corpses from the actor's last direction and death pose beneath living actors; hide the old fading enemy view once its corpse view exists.
- [x] Render impacts with a sharp initial spray and a spreading dark-red stain; render prints at a stride interval only while actors cross pools. Bound transient effects and preserve y-depth under the multiply lighting layer.
- [x] Dispose all effects, tweens, and listeners on encounter reset, room transition, and scene shutdown.
- [x] Run the targeted browser tests and confirm pass.
- [x] Commit as `feat: add persistent blood and corpse visuals`.

### Task 4: Whole-game validation and Windows release

**Files:**
- Modify: `README.md`, `docs/art-direction.md`, `desktop/release-notes.md`, `package.json`, `package-lock.json`.
- Test: all `tests/*.spec.ts` and `desktop/tests/app.spec.ts`.

- [x] Add integration coverage for pooled blood/footprint cleanup after repeated scene restart and verify no external art request is made.
- [x] Run `CHROMIUM_PATH=/usr/bin/chromium npm test`.
- [x] Run `npm run build`; attempt `npm run test:desktop` and record the missing Electron binary/network blocker.
- [x] Update art docs and release notes with the actual walk-strip limits, blood behavior, room lifetime, and current version.
- [x] Commit as `docs: describe blood and walk animation release`.
- [ ] Push the validated source and `v0.5.0` tag, then verify the Windows workflow publishes both EXE files.

Local desktop test limitation: all three Linux Electron tests are blocked because this environment has no Electron binary and the GitHub release artifact request fails with `ECONNREFUSED`. The Windows release workflow installs Electron on GitHub-hosted Windows and runs the packaged-app smoke tests there.
