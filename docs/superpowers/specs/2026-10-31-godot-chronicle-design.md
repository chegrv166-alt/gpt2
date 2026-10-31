# Ashen Covenant — Godot redesign: «Имя, которого нет»

## Agreed direction
Godot 4.6, isometric 2D, single-player party RPG. References: Divinity Original Sin (solutions and tactical combinations), Tyranny (institutions and consequences), Banner Saga (companions and costs). Visual tone: Vampire Hunter D, Berserk, Claymore, David Cronenberg.

The protagonist was an ordinary chronicler investigating genuine records of a person absent from reality. The investigation provoked false accusations of sexual violence. An investigator, corrupt judge, executioner and abusive cellmate participated in his persecution. His final prayer, «Пусть они почувствуют то, что чувствую я», killed all four. Their personalities and skills remain inside the resurrected, amnesiac mutant. He believes himself chosen by an unknown god and seeks vengeance against that god. Sources and the truth of the nonexistent person remain unresolved. Where he hid old records is deliberately deferred.

The protagonist and some companions are cursed; others are not. Within a battle transformation increases independent strength and reduces group interaction. It is reversible only after battle. Four dead personalities offer abilities and dialogue options; occasional conversations are actually taken over. Important allegiance/end decisions belong to the player; takeovers change the situation and have persistent consequences. Historical abuse is conveyed without depicting assaults.

## First playable episode (implementation defaults)
The user approved proceeding with the proposed 20–30 minute episode and selected Godot. The duration is a design target pending human playtesting, not a verified runtime claim. Implement natively in the existing isolated checkout on a feature branch. Do not publish a new version as part of this task.

Working location: Вель, a settlement outside a closed infirmary. Three playable companions: chronicler (cursed), Mira (uncursed ranged fighter), Sava (cursed healer). Names are provisional. Explore a connected isometric map by click, examine evidence, talk to witnesses and officials. Obtain access through payment/negotiation, documentary evidence or a tactical confrontation. Resolve the infirmary through prisoner extraction, ritual interruption, or a documented bargain with a human cost. Consequences update journal, faction stance and companion trust. Permit revisits and manual save/load.

Three compact encounter templates: gate confrontation, prisoner extraction, ritual interruption. Alternate short allied/enemy activations. Each allied activation has 2 AP, movement costs 1 AP with a bounded path, attacks cost 1, skills 1–2. Show enemy intents, legal movement/targets, queue and objective. Mutations 0/1/2: increasing personal damage/range or regeneration, support coefficients 1.0/0.65/0.3. Both source and recipient compatibility affect support. Mutation escalates during combat and resets after the encounter. Cursed allies have distinct forms; humans retain meaningful attack/support abilities. Failure offers retreat/retry, not a dead end.

Four voices have per-voice pressure increased by borrowing their skills or choosing their replies. A visible threshold and NPC-specific triggers cause a short takeover once per relevant conversation; the NPC reacts and journal/trust changes immediately. Rest and returning to human form are distinct: bodily transformation clears after battle, memory/voice pressure persists and can be managed at camp.

## Architecture and boundaries
`godot/` is a standalone project, independent of Node/npm and legacy Electron packaging. RefCounted campaign and tactical simulation own state; Node2D world/battle renderer owns drawing, movement interpolation and camera; native Control HUD owns text, dialogue, journal, party, saves and input focus. Content uses JSON. Saves include version, flags, evidence, journal, resources, party, voice pressure and active battle state. Validate before replacing live state. Reuse only repository-owned painted sprites, with provenance; no paid providers, external asset package admission or game-dev CLI substitute.

## Visual target
Full playfield, restrained bone/ochre text, charcoal/green masonry, wine-red living tissue, readable silhouettes. Settlement has distinct archive, camp, well, memorial, gate and infirmary landmarks, streets and organic encroachment. HUD separates exploration from tactical controls; dialogue/journal are focused overlays. Actions have short visible feedback and consequences.

## Acceptance and practical limits
- Launchable Godot project and a runnable development package; attempt native platform exports if matching official templates are available.
- Pure simulation tests: AP legality, occupied tiles/line of sight, alternating turns, objectives, transformation/support, defeat/retry, dialogue gates, takeover persistence, each resolution and save/load corruption handling.
- Scene integration smoke: real UI dialogue and tactical actions, save/load and resized layout. Capture a real rendered frame if a display backend can be provided; distinguish headless model validation from visual evidence.
- Build/import without GDScript errors. Verify legacy web build/tests since the repository retains its published version.
- No claim of polished final art, 20–30 minute enjoyment, Windows execution or hardware performance without direct evidence. Open questions about the full region, roster and mystery are left for subsequent episodes.
