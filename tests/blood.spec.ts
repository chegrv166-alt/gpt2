import { expect, test } from '@playwright/test';
import { BloodField } from '../src/blood/BloodField';

test('corpse and pool persist idempotently until clear', () => {
  const blood = new BloodField();
  expect(blood.addCorpse(7, 'boss', { x: 2, y: 3 }, 'nw')).toBe(true);
  expect(blood.addCorpse(7, 'boss', { x: 2, y: 3 }, 'nw')).toBe(false);
  expect(blood.corpses).toHaveLength(1);
  expect(blood.pools).toHaveLength(1);
  blood.update(99);
  expect(blood.corpses).toHaveLength(1);
  expect(blood.pools).toHaveLength(1);
  blood.clear();
  expect(blood.corpses).toHaveLength(0);
  expect(blood.pools).toHaveLength(0);
});

test('actors leave independent prints only while moving through blood and prints fade', () => {
  const blood = new BloodField();
  blood.addCorpse(4, 'grunt', { x: 0, y: 0 }, 's');
  blood.sampleActor(0, { x: -1, y: 0 }, 0.1);
  blood.sampleActor(4, { x: 2, y: 0 }, 0.1);
  expect(blood.sampleActor(0, { x: 1, y: 0 }, 0.6).length).toBeGreaterThan(0);
  expect(blood.sampleActor(4, { x: 3, y: 0 }, 0.6)).toHaveLength(0);
  expect(blood.footprints.every((print) => print.actorId === 0)).toBe(true);
  blood.update(5);
  expect(blood.footprints).toHaveLength(0);
});

test('impact produces a bounded cosmetic pool and a fading spray event', () => {
  const blood = new BloodField();
  const impact = blood.addImpact({ x: 1, y: 2 }, 9);
  expect(impact.intensity).toBe(2);
  expect(blood.pools[0]?.source).toBe('impact');
  blood.update(1);
  expect(blood.impacts).toHaveLength(0);
  expect(blood.pools).toHaveLength(1);
});
