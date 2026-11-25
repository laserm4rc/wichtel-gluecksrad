import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.js';
import { createApp } from '../server/app.js';

let server;
let baseUrl;
let store;
let people;

before(async () => {
  store = openDatabase(':memory:');
  people = ['Anna', 'Ben', 'Clara'].map((n) => store.addParticipant(n));
  const app = createApp({ store, config: { eventDefaults: { title: 'Test', budget: '20 €' }, adminPassword: '' } });
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

async function call(method, path, { body, token } = {}) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json(), setCookie: res.headers.get('set-cookie') };
}

async function login(password) {
  const res = await call('POST', '/api/login', { body: { password } });
  assert.equal(res.status, 200);
  assert.equal(res.setCookie, null, 'kein Cookie: nach einem Reload ist man abgemeldet');
  return res.body.token;
}

test('ohne Anmeldung: Event-Infos, aber keine Person', async () => {
  const res = await call('GET', '/api/session');
  assert.equal(res.status, 200);
  assert.equal(res.body.event.title, 'Test');
  assert.equal(res.body.user, null);
});

test('falsches Passwort wird abgelehnt', async () => {
  const res = await call('POST', '/api/login', { body: { password: 'gibts-nicht-123' } });
  assert.equal(res.status, 401);
});

test('Passwort mit Leerzeichen statt Bindestrichen wird abgelehnt', async () => {
  const res = await call('POST', '/api/login', { body: { password: people[0].password.replace(/-/g, ' ') } });
  assert.equal(res.status, 401);
});

test('abgelaufener Anmeldeschlüssel wird ignoriert', async () => {
  const { createToken } = await import('../server/auth.js');
  const old = createToken(store.getSessionSecret(), store.getParticipant(people[0].id), Date.now() - 13 * 60 * 60 * 1000);
  assert.equal((await call('GET', '/api/session', { token: old })).body.user, null);
});

test('Anmeldung, Drehen vor und nach dem Start der Ziehung', async () => {
  const token = await login(people[0].password);

  let session = await call('GET', '/api/session', { token });
  assert.equal(session.body.user.name, 'Anna');
  assert.deepEqual(session.body.user.wheel.sort(), ['Ben', 'Clara']);
  assert.equal(session.body.phase, 'setup');

  assert.equal((await call('POST', '/api/spin', { token })).status, 409);

  store.startDraw();
  session = await call('GET', '/api/session', { token });
  assert.equal(session.body.user.spun, false);
  assert.equal(session.body.user.result, undefined, 'Ergebnis bleibt vor dem Drehen geheim');

  const spin = await call('POST', '/api/spin', { token });
  assert.equal(spin.status, 200);
  assert.ok(['Ben', 'Clara'].includes(spin.body.receiver));

  const again = await call('POST', '/api/spin', { token });
  assert.equal(again.body.receiver, spin.body.receiver);

  // Auch nach dem Drehen steht das Ergebnis nicht in der Session: Bei jedem Besuch muss neu gedreht werden
  session = await call('GET', '/api/session', { token });
  assert.equal(session.body.user.spun, true);
  assert.equal(session.body.user.result, undefined);
});

test('gefälschter oder veralteter Anmeldeschlüssel wird ignoriert', async () => {
  const token = await login(people[1].password);
  const forged = token.replace(/^\d+/, String(people[2].id));
  assert.equal((await call('GET', '/api/session', { token: forged })).body.user, null);
  assert.equal((await call('GET', '/api/session', { token: 'unsinn' })).body.user, null);

  store.resetPassword(people[1].id);
  assert.equal((await call('GET', '/api/session', { token })).body.user, null);
});

test('Spinnen ohne Anmeldung ist nicht erlaubt', async () => {
  assert.equal((await call('POST', '/api/spin')).status, 401);
});
