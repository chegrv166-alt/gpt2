import { expect, test } from '@playwright/test';
import { ACTOR_IDS, ACTOR_SPECS, ACTOR_STATES, DIRECTIONS, FRAME_COUNT, actorTextureKey } from '../src/assets/catalog';

test('each actor has six walk frames while the other actor states keep four', () => {
  expect(FRAME_COUNT).toBe(4);
  for (const actor of ACTOR_IDS) for (const direction of DIRECTIONS) {
    const walk = ACTOR_SPECS.filter((spec) => spec.key.startsWith(`${actor}-walk-${direction}-`));
    expect(walk.map((spec) => spec.key)).toEqual(Array.from({ length: 6 }, (_, frame) => actorTextureKey(actor, 'walk', direction, frame)));
    for (const state of ACTOR_STATES.filter((value) => value !== 'walk')) {
      expect(ACTOR_SPECS.filter((spec) => spec.key.startsWith(`${actor}-${state}-${direction}-`))).toHaveLength(4);
    }
  }
});
