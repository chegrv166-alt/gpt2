# Painted Gothic Art Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans (Native, already selected by user). Implement inline; one independent final review.

**Goal:** Replace provisional Godot graphics with the approved original painted gothic art direction in actual playable scenes.
**Architecture:** An art library loads immutable image atlases and defines source regions, foot anchors, display sizes and matching hit rectangles. The existing world renderer composes these resources with native ground, light, atmosphere and combat overlays. Native Control HUD uses the same portrait art and a compact iron/bone theme.
**Tech Stack:** Godot 4.6.3, GDScript, host ImageGen original PNG sources; no new dependencies or paid third-party services.
**Spec:** `docs/superpowers/specs/2026-10-31-painted-gothic-art-design.md` (user approved).

## Global Constraints
- Preserve 32/16 isometric projection, nine locations and entrances at location.pos + (0,2).
- Preserve gameplay, save schema and model; mutation reverses after battle only.
- Keep image originals unchanged, exact prompts and provenance with SHA256; normalize with Godot atlas regions, no image-editing scripts.
- No publication in this task. Existing isolated branch: feat/painted-gothic-art.
- Differentiate concepts, actual rendered frames and target-OS execution evidence.

## Review Focus
- Large illustrations must not break targeting: drawing and hit bounds share art-library rectangles, reverse depth resolves overlaps.
- Foreground architecture and combat cover must not hide relevant units; depth and translucency preserve visibility.
- Forms 0/1/2 must select distinct images, including after save/load and retreat.
- At 960×640 text/buttons must remain inside their viewport, without a large blank lower strip.
- Native exports must load all new atlas resources and retain embedded data.

### Task 1: Original art resources and shared geometry
**Files:** create `godot/assets/painted/`, `godot/scripts/view/art_library.gd`, `godot/tests/art_checks.gd`; update `godot/assets/PROVENANCE.md`, test runners.
**Interfaces:** `ArtLibrary.texture(key: String) -> Texture2D`; `ArtLibrary.rect(key: String, foot: Vector2, scale: float) -> Rect2`; `ArtLibrary.actor_key(actor: Dictionary) -> String`; metadata for atlases and display heights.
- [ ] Generate isolated original location/prop sheets, party/enemy sheet, four transformed bodies, portraits and terrain with shared upper-left light and 2:1 perspective; record prompts before calls.
- [ ] Inspect sources visually and validate dimensions/alpha/hashes. Record exact resource regions and ground anchors.
- [ ] Write meaningful failing checks for asset availability/geometry/unique mutation keys, run to confirm failures, then implement the library and rerun.
- [ ] Preserve originals, resource metadata and provenance; commit the resource/library deliverable.

### Task 2: World, battle and atmosphere
**Files:** modify `godot/scripts/view/world_view.gd`; create `godot/scripts/view/atmosphere.gdshader`; update scene checks.
**Interfaces:** existing `screen/ground/configure/_gui_input` remain; new shared `location_rect(location)` and `actor_rect(actor, foot)` drive rendering and picking.
- [ ] Replace geometric buildings, old sprites, circular trees and repeated bright tile borders with painted art and restrained terrain.
- [ ] Extend distant ground/scenery past navigation bounds; introduce layers of mist, local lantern glow, muted wet reflections and sparse drifting ash without hiding legal targets.
- [ ] Sort location/party and combat cover/units by depth; fade architecture obscuring allies; pick art silhouettes using the same bounds, preserving entrances.
- [ ] Show readable active unit/HP, movement boundaries and objective marks. Add native movement, breath and short distinct damage/healing/transformation feedback.
- [ ] Verify projection round-trip and enlarged silhouette clicks in scene checks, render exploration/battle/mutated views and inspect them; commit.

### Task 3: Matching HUD, dialogue and responsive composition
**Files:** modify `godot/scripts/view/game_hud.gd`, optional `godot/scripts/view/ornament.gd`; update scene checks and capture args in `godot/scripts/main.gd` only as needed.
**Interfaces:** retain all HUD signals, choice/action dictionaries, modal methods and board_slot; portrait keys use ArtLibrary.
- [ ] Replace green boxed panels with iron/bone/wine theme, restrained brass ornament, matching portraits and clear hierarchy.
- [ ] Make header and contextual bottom bar compact; adapt sidebar, portraits and action wrapping for actual 960×640 and 1440×900 sizes.
- [ ] Style dialogue/journal and mini-map consistently while preserving focus, modal click blocking, readable choices and save controls.
- [ ] Exercise real dialogue, tactics and resize; inspect actual render frames at both sizes; commit.

### Task 4: Verification and delivery
**Files:** update `godot/README.md`, art provenance and this checklist; produce ignored builds and review screenshots.
- [ ] Run import, art/geometry, model, scene and legal-playthrough checks. Run legacy build checks only if shared legacy files change.
- [ ] Export Windows and Linux with embedded new resources; launch Linux binary graphically for rendered verification.
- [ ] Obtain independent branch review, fix important findings and rerun affected checks.
- [ ] Commit the complete local result and report actual gameplay screenshots, launch path, verification and limitations without publishing.
