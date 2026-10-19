# Blood, Footprints, and Walk Cycles

## Goal

Make the approved 18+ dark-fantasy art direction read clearly during movement and combat: the hero and every enemy have a visible walk cycle, impacts produce blood, dead enemies remain as bodies with nearby pools, and actors track blood from those pools across the room.

## Accepted scope

- The user approved all four actors: hero, melee grunt, ranged caster, and mini-boss.
- The game is rated 18+. Blood can be emphatic and persistent while remaining painted fantasy art consistent with the existing atlas.
- Bodies and pools remain for as long as their room is active. Leaving/restarting the room clears them; a full run reset also clears them.
- Footprints fade over time. Blood is cosmetic and has no effect on combat, movement, or stats.
- Existing eight-direction controls and presentation keys remain supported. The four authored source views continue to map onto the existing direction set.

## Design

### Actor animation

The current atlas contains one painted pose per authored view. The walk state changes whole-sprite scale/position and segmented cloak strips, so it does not show a clear gait. Produce a six-frame transparent walk strip for each actor and each of the four existing source views from the approved in-game art. Normalize all frames to each actor's fixed texture size and foot anchor. The existing mapping from eight gameplay directions to four atlas views remains; idle, attack, and hurt keep their existing keys and behavior.

Keep `FRAME_COUNT = 4` for existing states and add a separate `WALK_FRAME_COUNT = 6`. At boot, bake the normalized walk frames into the same `actorTextureKey(actor, 'walk', direction, frame)` key pattern, then create six-frame Phaser animations with the current stable animation keys. Frame cadence follows motor distance so movement does not appear to moonwalk; attack, hurt, idle, and dead states stop walk playback.

### Room-local blood presentation

Keep simulation models independent from Phaser. Extend combat events only with data that the presentation needs (a stable actor identifier and ground-space position/direction). Add a disposable `RoomBlood` view/system owned by `GameScene`/`CombatView` that consumes combat events and samples living actor positions.

- A damage event creates several animated droplets and a dark red impact mark.
- An enemy death creates one non-fading ground-level corpse sprite and a persistent pool near the body. Corpses do not block movement or interaction and have no health bar, name, or target marker.
- The hero and enemies that walk over a pool leave paired, ground-aligned prints at a fixed travel interval. Prints fade; pools and bodies do not.
- Phaser depth follows the current isometric foot-depth convention. Blood remains under the room multiply-light map so torch lighting affects it consistently.
- Scene shutdown, room transition, run reset, and encounter reset dispose effects and listeners. No renderer objects or textures accumulate after restart.

### Assets and boundaries

Keep walk art under `src/assets/art/` and publish it through `PaintedTextures`/the existing asset catalog. Generate droplets, pools, and prints procedurally in `BootScene` with `Graphics`; this keeps gore effects local and cached with the other game textures. Combat decides when damage/death happens; the room view decides how it looks.

## Verification

- Unit checks: every actor/view receives a complete walk strip; all frames preserve a non-empty silhouette and consistent foot anchor; damage and death events contain the needed target information; blood sampling creates prints only after an actor walks through a pool; decals are room-scoped and cosmetic.
- Browser checks: moving hero and pursuing enemies advance walk frames; a real hit creates blood; killing an enemy leaves a stable corpse and pool; crossing that pool creates fading footprints for both teams; leaving/restarting the room leaves no old blood or duplicate lighting/floor resources.
- Build remains strict TypeScript and the desktop package continues to start from bundled local files.

## Risks and constraints

- Generated strips may drift from the source pose or shift their foot anchor. Normalize and inspect each strip at in-game scale before replacing texture keys; keep the approved source art as frame zero where the generated pose permits it.
- Blood sprites can obscure combat feedback. Keep health, boss telegraph, floating damage text, and loot readable above the world effects.
- Keep decal/effect counts bounded within a room and destroy all temporary sprites/tweens on reset or shutdown.
