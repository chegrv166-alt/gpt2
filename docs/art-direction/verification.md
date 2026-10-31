# Painted gothic overhaul — verification

This is the historical local QA record before publication. Release 0.7.1 additionally runs the complete suite, native exports and packaged-application headless startup on Windows and Linux in [GitHub Actions](https://github.com/chegrv166-alt/gpt2/actions/workflows/godot-release.yml). Player downloads are published at [v0.7.1](https://github.com/chegrv166-alt/gpt2/releases/tag/v0.7.1) after both platforms pass. The local source commit and archive hashes below describe the earlier local build, not the CI release assets.

Local playable draft **0.7.1**, Godot **4.6.3**. Source-code commit: `b86fc4cf64731437ac8d092cc598c94ce05be5f2`; later documentation commits only record this evidence. Work remains on `feat/painted-gothic-art` in the managed checkout, without remote publication.

## Automated checks

`bash godot/tools/check.sh`: **235 checks, zero failures** — 74 model, 77 art/resource, 21 scene integration, 33 visual/interaction/layout, 30 legal playthrough. The playthrough suite wins all three encounter types. New integration coverage includes opaque head targeting, click-through transparent corners, equal-depth overlapping transformed allies, legacy prisoner art mapping, portrait selection, camera framing and real 1440×900 / 960×640 layout constraints.

Independent whole-branch review identified one important defect: overlapping equal-depth actors could select the ally behind the visible sprite. The regression test failed before the fix and passed afterward; rendering and picking now share one stable ordered list, reversed for input. The entire suite passed after the fix. No critical or deferred minor findings remain.

## Render and package evidence

- Actual source-scene OpenGL captures: `gameplay/{exploration,mutation,dialogue}.png`, `gameplay/{battle-960,dialogue-960}.png`. The mutation image is a render fixture of real model states, not a recorded legal-input playthrough.
- Actual exported Linux executable, launched from `/tmp` without a project path: `gameplay/exploration-native.png` and `gameplay/battle-native.png`. Readiness reports version 0.7.1, three companions, nine locations and mounted world/HUD. No script or runtime errors. Rendering used Mesa 25 / llvmpipe OpenGL 4.5 under Xvfb.
- Windows PE x64 and Linux ELF formats, appended GDPC resource pack, source-image SHA256 and archive integrity verified. Both embedded packs were independently loaded by Godot from outside the project; all new atlases and the final targeting-fix method were available in compiled resources.
- Windows executable was cross-exported on Linux. This draft was not executed under Windows; loading its resource pack on Linux does not certify Windows graphics or GPU drivers. Prior 0.7.0 Windows CI is not claimed as validation of 0.7.1.
- No legacy TypeScript/Electron runtime code changed. Animation remains procedural movement/breath and short feedback; a full directional multi-frame animation set is outside this approved iteration.

## Local player downloads

Archives are ignored build products under `release-godot/`, with Russian instructions, engine/font licenses and source/executable manifests. No release tag was pushed.

| Archive | Bytes | SHA256 |
| --- | ---: | --- |
| Ashen-Covenant-0.7.1-Windows-x64.zip | 52825266 | 220abde5d9b4880f93a5622e6c6503d4d2e0b83961c9c881f1a0e7223f09853e |
| Ashen-Covenant-0.7.1-Linux-x86_64.tar.gz | 43931795 | 117fe5e2ad569340c75d2157fd4301373b1e339dd43a765a433c15dde3ffd2a7 |

Windows ZIP passed CRC verification and its executable matches the manifest. Linux tar preserves execution permission and its executable matches the manifest. Both manifests reference the source-code commit above.
