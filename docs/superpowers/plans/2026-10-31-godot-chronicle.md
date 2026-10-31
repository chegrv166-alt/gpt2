# Godot chronicle episode implementation plan

> Execute with superpowers:executing-plans (Native). One independent final review.

**Goal:** Deliver the first playable Godot episode demonstrating the agreed investigation/party/curse loop.
**Architecture:** Standalone Godot project, pure campaign/tactics, JSON content, native isometric renderer and Control HUD.
**Tech Stack:** Godot 4.6.3, GDScript, repository-owned painted textures; no new npm dependencies.
**Spec:** `docs/superpowers/specs/2026-10-31-godot-chronicle-design.md`.

## Global constraints
Preserve published 0.6 web application; work in `godot/` on this existing isolated checkout. No worktree, provider spending or publication. Mutation reversible after combat only; stronger solo/weaker group; all four persecutors dead; existing story mysteries remain unresolved. Target duration is unverified until human playtesting.

## Review focus
- Illegal/blocked actions consume no AP and do not advance turns.
- Final/defeat states cannot strand the campaign; objectives can finish without clearing all enemies.
- Takeovers apply once and save/load cannot duplicate rewards or restore stale dialogue effects.
- Transformed source and target both reduce support; no mid-battle reversion.
- UI consumes clicks over panels and remains usable at 960×640 and 1440×900.

## Task 1: Simulation and content
Files: `godot/scripts/model/{campaign,tactical_battle,episode_data}.gd`, `godot/content/episode.json`, `godot/tests/run_tests.gd`.
Interfaces: `Campaign.talk/choose/start_battle/finish_battle/to_dict/restore`; `TacticalBattle.move_unit/attack/use_skill/transform/end_activation/interact/to_dict/restore`.
- [x] Write/run failing model tests before implementation.
- [x] Implement deterministic AP/turn/LOS/objective models and JSON content with three routes.
- [x] Verify transformation, actual dialogue takeover, resources/party persistence and save validation.

## Task 2: Playable world and HUD
Files: `godot/project.godot`, `godot/main.tscn`, `godot/scripts/{main,view/world_view,view/game_hud}.gd`, `godot/assets/`.
- [x] Add scene smoke exercising real button and board actions.
- [x] Build an explorable connected settlement, isometric art/actors, battle movement/targeting/feedback and native HUD.
- [x] Connect evidence/dialogues, three encounter templates, endings, journal and atomic saves.
- [x] Verify keyboard/mouse, modal input, viewport resize, defeat/retry and restart.

## Task 3: Package and validation
Files: `godot/README.md`, `godot/export_presets.cfg`, root `.gitignore`/README and build/test helper scripts if necessary.
- [x] Run import/model/integration checks and inspect actual rendered screenshots.
- [x] Produce runnable desktop artifact using verified engine/template inputs; report exact export limits.
- [x] Run legacy build and relevant complete tests; request independent whole-change review and fix important issues.
- [x] Record evidence, commit local implementation, report playable entry point and limits.
