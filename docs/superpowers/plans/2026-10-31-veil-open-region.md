# Veil Open Region Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans, Native already selected. User explicitly approved design and asked to continue implementation. One fresh whole-branch review at completion.

**Goal:** Deliver an actual spacious, populated 512×384 continuous region in the existing Godot game.
**Architecture:** Declarative region data and a cached WorldLayout own geography, terrain masks, physical footprints, roads and indexed scenery. Campaign owns discoveries, camp travel and save migration. World renderer and a native regional map consume the same geography; original tactics remain independent.
**Tech Stack:** Godot 4.6.3 / GDScript, JSON, existing painted atlases plus original host ImageGen scenery where needed.
**Spec:** `docs/superpowers/specs/2026-10-31-veil-open-region-design.md` (approved).

## Global Constraints
- 512×384, five districts, 30 named locations +16 discoveries, four nonfinal optional encounters.
- Preserve three original tactical scenes, curse rules and story outcomes; migrate version1 saves including nested checkpoints.
- Work in existing managed checkout, branch feat/veil-open-region; no remote publication.
- Native Godot implementation, no paid providers/installations; preserve art originals/prompts/provenance.
- Show real captures and exact platform-verification limits.

## Review Focus
- All entrances and camps must be reachable across real bridges; collider/terrain/map geography must agree.
- Negative/edge destinations and corrupted or old save coordinates must not strand/replace the campaign.
- Distant objects, hidden discoveries and tall sprites must render/pick correctly across scenery-sector edges.
- New road victories and repeat clicks/loads must not finish the episode or duplicate rewards.
- Actual small-window map/modal controls, long routes, fast travel and camera following must remain usable.

### Task 1: Geography and region content
**Files:** create `godot/content/region.json`, `godot/scripts/model/world_layout.gd`, `godot/tests/region_checks.gd`; modify `episode.json`, `episode_data.gd`, check runners.
**Interfaces:** WorldLayout.bounds/start/district_at/entrance/blocked/road_strength/navigation/terrain_texture/scenery_near; Data.locations remains the authoritative 46-point list. Region declares five districts, roads, river, bridges and camps.
- [x] Write/run failing geography checks for dimensions, 46 interactions, five camps, reachability and water/bridge collision.
- [x] Author spaced main and side places with real conversations/one-time finds; add four encounter templates with explicit local rewards.
- [x] Implement deterministic cached masks/footprints and sector-indexed scenery; verify paths to every entrance and multiple river crossings.
- [x] Run new checks and baseline model suite, commit.

### Task 2: Campaign exploration and safe persistence
**Files:** modify `campaign.gd`; extend `region_checks.gd` and model checks.
**Interfaces:** discover(position), discovered/visited sectors, fast_travel(id), version2 snapshot and version1 migration; result handling distinguishes final encounters explicitly.
- [x] Write/run failing tests for old campaign/checkpoint migration, discovery persistence, safe camp-only travel, one-time reward and nonfinal road victories.
- [x] Implement version2 validation and atomic migration; preserve old active-battle data and outcomes.
- [x] Implement discovery and travel using WorldLayout entrance/camp data; optional road victories set explicit flags/rewards.
- [x] Run complete model/region tests, commit.

### Task 3: Spacious rendered world and navigation UI
**Files:** modify `world_view.gd`, `ground.gdshader`, `game_hud.gd`, `main.gd`; create `region_map.gd`; add painted scenery and provenance if required; update visual checks/capture helper.
**Interfaces:** WorldView.navigate_to(point), campaign-backed discovery, local minimap and M overview; RegionMap.destination_selected/travel_selected signals; same bounds/roads/river as physics.
- [x] Write/run failing scene checks for far movement, M map/input blocking, destination and compact layout.
- [x] Render visible scenery sectors with margin for tall art; use data-driven terrain mask, river banks, bridge surfaces, dense streets/courts and varied outskirts.
- [x] Add district naming, local minimap, full region overview with discoveries/waypoints, Shift jog and safe discovered-camp travel.
- [x] Inspect actual city/river/forest/cemetery/monastery frames, plus 960×640 overview/battle; verify real path traversal and culling; commit.

### Task 4: Validation and local desktop delivery
**Files:** update README/player notes/version/export helpers, verification report and capture artifacts.
- [x] Run complete import/model/art/scene/region/visual/playthrough suites; verify data and art integrity.
- [x] Export Windows/Linux with embedded resources; boot/render Linux outside source project and inspect captures.
- [x] Obtain independent branch review, fix important findings with regression checks, rerun affected complete suite.
- [x] Build local archives with licenses/manifests/checksums, document actual evidence, commit and keep branch locally.
