# Forest first level implementation plan

> Execute with superpowers:executing-plans, Native, as requested.

**Goal:** Add a 92×23 forest corridor with knife, spear and bow bandits before the two existing levels.
**Architecture:** Keep Phaser simulation/render separation. Extend room data and enemy definitions, share inventory/stats through existing scene transfers, fit minimap to rectangular bounds, use forest ambient lighting and locally generated native textures.
**Tech Stack:** TypeScript strict, Phaser 3.90, Vite, Playwright. No new dependencies.
**Spec:** User-approved request in this conversation (2026-10-30).

## Constraints and decisions
- Existing isolated cloud checkout, feature branch; no additional worktree.
- Three levels: forest → sanctuary → crypt. Existing dungeon layouts/enemies retained.
- Forest has no supernatural boss; defeating all bandits unlocks its exit. Dungeon boss victory and full-clear requirements remain.
- Preserve bag/equipment/HP/mana on transitions; respawn in current level, R resets to forest.
- Native procedural forest and bandit art, including distinct weapon silhouettes and arrow projectiles; no external downloads.
- Review focus: long-map bounds and minimap fit; reachable spawns and exit; archer wall collision/retreat; both transitions and no fourth level; cleanup/reset after death or inventory modal.

## Tasks
- [x] 1. Add failing tests for forest geometry, bandit combat and three-level progression. Run focused tests to observe failure.
- [x] 2. Extend rooms/layout and progression, distinguishing forest clearance from dungeon boss requirements. Keep dungeon regressions targeting the original rooms explicitly.
- [x] 3. Add bandit definitions/AI, native weapon art and arrows. Test spear reach, archer shooting/retreat and blocked shots.
- [x] 4. Fit minimap to room bounds, add forest textures/lighting, update HUD/exit labels and transitions. Add real browser coverage of forest and full campaign with retained gear.
- [x] 5. Run build, complete browser suite and desktop smoke tests, inspect forest screenshot, request one independent whole-change review, resolve important findings, update README.
