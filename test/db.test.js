import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, StoreError } from '../server/db.js';

function setup(names = ['Anna', 'Ben', 'Clara', 'David']) {
  const store = openDatabase(':memory:');
  const people = names.map((n) => store.addParticipant(n));
  return { store, people };
}

test('Passwörter werden erzeugt, sind eindeutig und haben Bindestriche statt Leerzeichen', () => {
  const { store, people } = setup();
  assert.equal(new Set(people.map((p) => p.password)).size, people.length);
  for (const p of people) assert.match(p.password, /^[a-z]+-[a-z]+-\d{3}$/);

  const anna = people[0];
  assert.equal(store.findByPassword(anna.password)?.id, anna.id);
  // Großschreibung und Leerzeichen am Rand sind egal (Handy-Tastatur) …
  assert.equal(store.findByPassword(` ${anna.password.toUpperCase()} `)?.id, anna.id);
  // … aber Leerzeichen statt Bindestrichen oder ganz ohne Trennzeichen passen nicht
  assert.equal(store.findByPassword(anna.password.replace(/-/g, ' ')), undefined);
  assert.equal(store.findByPassword(anna.password.replace(/-/g, '')), undefined);
  assert.equal(store.findByPassword('falsch-falsch-000'), undefined);
  assert.equal(store.findByPassword(''), undefined);
});

test('selbst vergebene Passwörter müssen Bindestriche statt Leerzeichen haben', () => {
  const { store } = setup();
  assert.throws(() => store.addParticipant('Emil', 'schnee mann 12'), StoreError);
  assert.throws(() => store.addParticipant('Emil', 'schnee--mann'), StoreError);
  assert.throws(() => store.addParticipant('Emil', 'ab'), StoreError);
  assert.equal(store.addParticipant('Emil', 'Schnee-Mann-12').password, 'schnee-mann-12');
});

test('doppelte Namen und Passwörter werden abgelehnt', () => {
  const { store, people } = setup();
  assert.throws(() => store.addParticipant('anna'), StoreError);
  assert.throws(() => store.addParticipant('Emil', people[1].password), StoreError);
  assert.throws(() => store.addParticipant('   '), StoreError);
});

test('Ziehung: jede Person dreht, Ergebnis bleibt gleich', () => {
  const { store, people } = setup();
  assert.equal(store.getPhase(), 'setup');
  assert.throws(() => store.spin(people[0].id), StoreError);

  store.startDraw();
  assert.equal(store.getPhase(), 'open');
  assert.throws(() => store.startDraw(), StoreError);
  assert.throws(() => store.addParticipant('Emil'), StoreError);

  const first = store.spin(people[0].id);
  assert.ok(first.spunAt);
  assert.notEqual(first.receiver, people[0].name);
  const again = store.spin(people[0].id);
  assert.deepEqual(again, first);

  const receivers = people.map((p) => store.spin(p.id).receiver);
  assert.equal(new Set(receivers).size, people.length);
});

test('Zurücksetzen erlaubt eine neue Ziehung', () => {
  const { store } = setup();
  store.startDraw();
  store.resetDraw();
  assert.equal(store.getPhase(), 'setup');
  store.addParticipant('Emil');
  store.startDraw();
  assert.equal(store.listAssignments().length, 5);
});

test('neues Passwort ersetzt das alte', () => {
  const { store, people } = setup();
  const old = people[0].password;
  const updated = store.resetPassword(people[0].id);
  assert.notEqual(updated.password, old);
  assert.equal(store.findByPassword(old), undefined);
  assert.equal(store.findByPassword(updated.password)?.id, people[0].id);
});
