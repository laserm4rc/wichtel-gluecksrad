import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDateTime, parseLocalDateTime, zonedTimeToDate } from '../server/time.js';

const TZ = 'Europe/Berlin';

test('Ortszeit Berlin → UTC, Winter- und Sommerzeit', () => {
  // Winter: UTC+1
  assert.equal(zonedTimeToDate({ year: 2026, month: 11, day: 30, hour: 18, minute: 0 }, TZ).toISOString(), '2026-11-30T17:00:00.000Z');
  // Sommer: UTC+2
  assert.equal(zonedTimeToDate({ year: 2026, month: 7, day: 1, hour: 12, minute: 30 }, TZ).toISOString(), '2026-07-01T10:30:00.000Z');
});

test('Datumseingaben aus der Konsole', () => {
  const expected = '2026-11-30T17:00:00.000Z';
  assert.equal(parseLocalDateTime('30.11.2026 18:00', TZ).toISOString(), expected);
  assert.equal(parseLocalDateTime('30.11.2026, 18:00 Uhr', TZ).toISOString(), expected);
  assert.equal(parseLocalDateTime('2026-11-30 18:00', TZ).toISOString(), expected);
  assert.equal(parseLocalDateTime('2026-11-30T18:00', TZ).toISOString(), expected);
  assert.equal(parseLocalDateTime('30.11.2026', TZ).toISOString(), '2026-11-29T23:00:00.000Z', 'ohne Uhrzeit = 00:00');
  assert.equal(
    parseLocalDateTime('30.11. 18:00', TZ, new Date('2026-11-25T12:00:00Z')).toISOString(),
    expected,
    'ohne Jahr = aktuelles Jahr',
  );
});

test('ungültige Eingaben ergeben null', () => {
  for (const input of ['', 'morgen', '31.11.2026', '30.13.2026', '30.11.2026 25:00', '2026-02-30']) {
    assert.equal(parseLocalDateTime(input, TZ), null, input);
  }
});

test('Anzeige auf Deutsch in Ortszeit', () => {
  assert.equal(formatDateTime(new Date('2026-11-30T17:00:00Z'), TZ), 'Montag, 30. November 2026 um 18:00 Uhr');
});
