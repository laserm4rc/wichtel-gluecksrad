import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAssignment, DrawError } from '../server/draw.js';

function assertValid(ids, result, exclusions = []) {
  assert.equal(result.size, ids.length);
  assert.deepEqual([...result.values()].sort((a, b) => a - b), [...ids].sort((a, b) => a - b), 'jede Person genau einmal gezogen');
  for (const [giver, receiver] of result) {
    assert.notEqual(giver, receiver, 'niemand zieht sich selbst');
    for (const [a, b] of exclusions) {
      assert.ok(!(giver === a && receiver === b) && !(giver === b && receiver === a), 'Ausschluss beachtet');
    }
  }
}

test('gültige Zuteilung für verschiedene Gruppengrößen', () => {
  for (let n = 2; n <= 30; n++) {
    const ids = Array.from({ length: n }, (_, i) => i + 1);
    for (let run = 0; run < 20; run++) assertValid(ids, computeAssignment(ids));
  }
});

test('Ausschlüsse werden in beide Richtungen beachtet', () => {
  const ids = [1, 2, 3, 4, 5, 6];
  const exclusions = [[1, 2], [3, 4], [5, 6]];
  for (let run = 0; run < 200; run++) assertValid(ids, computeAssignment(ids, exclusions), exclusions);
});

test('viele Ausschlüsse: Backtracking findet die einzige Lösung', () => {
  // 1 darf nur 2, 2 nur 3, 3 nur 4, 4 nur 1 ziehen
  const ids = [1, 2, 3, 4];
  const exclusions = [[1, 3], [2, 4]];
  for (let run = 0; run < 50; run++) assertValid(ids, computeAssignment(ids, exclusions), exclusions);
});

test('unmögliche Fälle werfen einen verständlichen Fehler', () => {
  assert.throws(() => computeAssignment([1]), DrawError);
  assert.throws(() => computeAssignment([1, 2], [[1, 2]]), DrawError);
  assert.throws(() => computeAssignment([1, 2, 3], [[1, 2], [1, 3]]), DrawError);
});

test('Verteilung ist zufällig (nicht immer dieselbe Zuteilung)', () => {
  const ids = [1, 2, 3, 4, 5];
  const seen = new Set();
  for (let run = 0; run < 200; run++) seen.add(JSON.stringify([...computeAssignment(ids)]));
  // 5 Personen haben 44 mögliche Derangements
  assert.ok(seen.size > 30, `nur ${seen.size} verschiedene Zuteilungen`);
});
