# Asset provenance

## Painted gothic overhaul (2026-10-31)

`painted/{landmarks,props,characters,mutations,portraits,dialogue_portraits,terrain}.png` are original illustrations generated with the session's host ImageGen for this project after the user selected and approved the painted isometric direction. They are not copied frames or characters from the reference works. No paid third-party generation provider, external asset pack or stock license was used. Local `game-dev` CLI is unavailable; these files are ordinary verified project resources, not a CLI canonical-package claim.

Exact prompts and alpha/background intent: `painted/prompts.json`, `painted/characters-spacing-prompt.txt` and `painted/dialogue-portraits-prompt.txt`. The first character sheet is preserved in commit 2f269f5; the revised sheet is unchanged host ImageGen output. Source dimensions, modes and SHA256: `painted/sources.json`. The original source bytes are retained unchanged. Reference-only concept and its prompt: `docs/art-direction/painted-gothic-concept.png` and `docs/superpowers/specs/2026-10-31-painted-gothic-concept-prompt.txt` at repository root. The concept is not a gameplay screenshot.

Runtime regions and ground anchors are in `scripts/view/art_library.gd`: 3×2 sheets for landmarks, props, normal characters and portraits (including dialogue_portraits); 2×2 sheets for mutation forms and terrain. The landmark sheet has explicitly inspected nonuniform vertical regions to retain complete foundations and spires; `SOURCE_REGIONS` records exact source-pixel rectangles. `SILHOUETTES` refines these to inspected physical alpha bounds, excluding distant soft halos. Alpha-bounded resource regions retain three clear pixels and use AtlasTexture.filter_clip; source image bytes are never cropped or rewritten. Runtime sizes/anchors are in `HEIGHTS` and `rect()`. The same rectangles are used for drawing and picking.

Palette and intended use: 2:1 isometric 2D game art with upper-left light, slate/limestone/bone/oxblood materials. Sources include all nine location kinds, two trees, cover, three companions, two hostile humans, a prisoner, four full transformed bodies, twelve portraits and four ground materials. UI and atmosphere are authored natively in Godot. Source/geometry checks are in `tests/art_checks.gd`; import, actual rendered captures and native exports are verified separately.

## Earlier prototype resources

hero.png, mira.png and sava.png are unchanged copies of repository-owned painted walk atlases from src/assets/art/walk/{hero,grunt,caster}.png. They were provisional character art used before the overhaul. materials.png is an unchanged earlier repository-owned material atlas. They remain as historical project resources; the new visual system uses `painted/`.

body.ttf and title.ttf are DejaVu Sans and DejaVu Serif copied from the installed Debian fonts-dejavu-core package. License: DejaVu-LICENSE.txt.

In the earlier prototype, buildings, organic structures and terrain were drawn with native Godot CanvasItem APIs. The overhaul replaces their visible art with the painted atlases; composition, cursor marks and effects remain native. No paid provider jobs or external asset packages.

Godot-LICENSE.txt and Godot-COPYRIGHT.txt are the official Godot 4.6.3 license and third-party attribution files from the godotengine/godot 4.6.3-stable tag. Native binaries use official templates verified against Godot SHA512-SUMS.txt.

## Open county extension (0.8.0)

`painted/region_scenery.png` is an unchanged original host ImageGen six-object atlas (joined timber houses, warehouse, inn, bridge study, graves and cypresses). `painted/region_bridge.png` is a separate unchanged original bridge illustration aligned with the actual river crossings. Exact prompts are `region-scenery-prompt.txt` and `region-bridge-prompt.txt`; hashes/dimensions are in sources.json. Runtime uses the full bridge source as one atlas cell; custom regions for the first bridge study, grave cluster and pine are recorded in ArtLibrary. Crop bounds stay within each actual resource region, including nonuniform atlas cells. No source PNG was rewritten. District streets, river mask, quarry relief, nav footprints and sector indices are generated natively from content/region.json; they are not external asset packages.

`painted/region_harbor.png` is an unchanged original host ImageGen 3×2 atlas: timber pier, boat, ferry, iron fence, loaded cart and cargo barrels. Prompt: `region-harbor-prompt.txt`; source hash and dimensions are in sources.json. Piers share authored walkable footprints with the navigation mask; boats and ferry are scenery over water.
