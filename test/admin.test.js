import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.js';
import { createApp } from '../server/app.js';

const ADMIN_PASSWORD = 'test-admin-passwort';
let servers = [];

async function start(adminPassword = ADMIN_PASSWORD) {
  const store = openDatabase(':memory:');
  const app = createApp({ store, config: { eventDefaults: { title: 'Test' }, adminPassword, baseUrl: '' } });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  servers.push(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const call = async (method, path, { body, token } = {}) => {
    const res = await fetch(baseUrl + path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { status: res.status, body: json, text, headers: res.headers };
  };

  const adminLogin = async () => {
    const res = await call('POST', '/api/admin/login', { body: { password: ADMIN_PASSWORD } });
    assert.equal(res.status, 200);
    return res.body.token;
  };

  return { store, call, adminLogin };
}

before(() => {
  servers = [];
});
after(() => servers.forEach((s) => s.close()));

test('ohne ADMIN_PASSWORD ist der Admin gesperrt', async () => {
  const { call } = await start('');
  assert.equal((await call('POST', '/api/admin/login', { body: { password: '' } })).status, 503);
  assert.equal((await call('GET', '/api/admin/state')).status, 401);
});

test('falsches Passwort und fehlender Schlüssel werden abgelehnt', async () => {
  const { call } = await start();
  assert.equal((await call('POST', '/api/admin/login', { body: { password: 'falsch' } })).status, 401);
  assert.equal((await call('GET', '/api/admin/state')).status, 401);
  assert.equal((await call('GET', '/api/admin/state', { token: 'admin.1.abc' })).status, 401);
});

test('Teilnehmer-Schlüssel gilt nicht für den Admin', async () => {
  const { call, store } = await start();
  const p = store.addParticipant('Anna');
  const login = await call('POST', '/api/login', { body: { password: p.password } });
  assert.equal((await call('GET', '/api/admin/state', { token: login.body.token })).status, 401);
});

test('kompletter Ablauf: Teilnehmer, Ausschluss, Ziehung, Export', async () => {
  const { call, adminLogin } = await start();
  const token = await adminLogin();

  let res;
  for (const name of ['Anna', 'Ben', 'Clara', 'David']) {
    res = await call('POST', '/api/admin/participants', { token, body: { name } });
    assert.equal(res.status, 200);
  }
  assert.equal(res.body.participants.length, 4);
  assert.equal((await call('POST', '/api/admin/participants', { token, body: { name: 'anna' } })).status, 400);

  const [anna, ben] = res.body.participants;
  res = await call('POST', '/api/admin/exclusions', { token, body: { a: anna.id, b: ben.id } });
  assert.deepEqual(res.body.exclusions, [{ a: anna.id, b: ben.id }]);

  res = await call('POST', '/api/admin/draw/start', { token });
  assert.equal(res.body.phase, 'open');
  assert.equal(res.body.assignments.length, 4);
  for (const a of res.body.assignments) {
    assert.ok(!(a.giverId === anna.id && a.receiverId === ben.id));
    assert.ok(!(a.giverId === ben.id && a.receiverId === anna.id));
  }

  // Nach der Ziehung sind Änderungen an der Liste gesperrt
  assert.equal((await call('POST', '/api/admin/participants', { token, body: { name: 'Emil' } })).status, 400);
  assert.equal((await call('DELETE', `/api/admin/participants/${anna.id}`, { token })).status, 400);

  res = await call('POST', '/api/admin/draw/redraw', { token });
  assert.equal(res.body.assignments.length, 4);

  const csv = await call('GET', '/api/admin/export.csv', { token });
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.equal(csv.text.trim().split('\r\n').length, 5);

  res = await call('POST', '/api/admin/draw/reset', { token });
  assert.equal(res.body.phase, 'setup');
  res = await call('DELETE', `/api/admin/participants/${anna.id}`, { token });
  assert.equal(res.body.participants.length, 3);
  assert.deepEqual(res.body.exclusions, [], 'Ausschluss verschwindet mit der Person');
});

test('Übersicht zeigt, wer sein Passwort schon benutzt hat', async () => {
  const { call, adminLogin, store } = await start();
  const token = await adminLogin();
  const anna = store.addParticipant('Anna');
  store.addParticipant('Ben');

  let state = (await call('GET', '/api/admin/state', { token })).body;
  assert.ok(state.participants.every((p) => p.firstLoginAt === null && p.loginCount === 0));

  await call('POST', '/api/login', { body: { password: anna.password } });
  await call('POST', '/api/login', { body: { password: anna.password } });
  state = (await call('GET', '/api/admin/state', { token })).body;
  const annaState = state.participants.find((p) => p.name === 'Anna');
  assert.ok(annaState.firstLoginAt);
  assert.equal(annaState.loginCount, 2);
  assert.equal(state.participants.find((p) => p.name === 'Ben').firstLoginAt, null);

  // Neues Passwort: gilt wieder als unbenutzt
  state = (await call('POST', `/api/admin/participants/${annaState.id}/password`, { token })).body;
  assert.equal(state.participants.find((p) => p.name === 'Anna').firstLoginAt, null);
});

test('jede Admin-Anfrage liefert einen frischen Schlüssel (Sitzung verlängert sich)', async () => {
  const { call, adminLogin } = await start();
  const token = await adminLogin();
  const res = await call('GET', '/api/admin/state', { token });
  const fresh = res.headers.get('x-admin-token');
  assert.match(fresh, /^admin\.main\.\d+\.[a-f0-9]{64}$/);
  assert.equal((await call('GET', '/api/admin/state', { token: fresh })).status, 200);
  assert.equal(res.body.role, 'main');
});

test('abgelaufene Admin-Sitzung (30 Minuten ohne Aktivität) wird abgelehnt', async () => {
  const { call, store } = await start();
  const { createAdminToken } = await import('../server/auth.js');
  const old = createAdminToken(store.getSessionSecret(), 'main', ADMIN_PASSWORD, Date.now() - 31 * 60 * 1000);
  assert.equal((await call('GET', '/api/admin/state', { token: old })).status, 401);
  const recent = createAdminToken(store.getSessionSecret(), 'main', ADMIN_PASSWORD, Date.now() - 29 * 60 * 1000);
  assert.equal((await call('GET', '/api/admin/state', { token: recent })).status, 200);
});

/** Hauptadmin legt einen Co-Admin an, Ziehung läuft. */
async function withCoAdmin(visibility) {
  const ctx = await start();
  const main = await ctx.adminLogin();
  for (const name of ['Anna', 'Ben', 'Clara']) ctx.store.addParticipant(name);
  ctx.store.startDraw();
  const created = await ctx.call('POST', '/api/admin/coadmin/password', { token: main });
  assert.equal(created.status, 200);
  const coPassword = created.body.newCoAdminPassword;
  assert.match(coPassword, /^[a-z]+-[a-z]+-[a-z]+-\d{2}$/);
  await ctx.call('PUT', '/api/admin/coadmin/visibility', { token: main, body: { visibility } });
  const login = await ctx.call('POST', '/api/admin/login', { body: { password: coPassword } });
  assert.equal(login.body.role, 'co');
  return { ...ctx, main, co: login.body.token, coPassword };
}

test('Co-Admin "hidden": sieht keine Namen, kann nicht aufdecken oder exportieren', async () => {
  const { call, co } = await withCoAdmin('hidden');
  const state = (await call('GET', '/api/admin/state', { token: co })).body;
  assert.equal(state.role, 'co');
  assert.equal(state.assignmentsVisibility, 'hidden');
  assert.equal(state.coAdmin, undefined, 'Co-Admin-Einstellungen sieht nur der Hauptadmin');
  assert.equal(state.assignments.length, 3);
  for (const a of state.assignments) {
    assert.equal(a.receiver, undefined);
    assert.equal(a.receiverId, undefined);
  }
  assert.equal((await call('POST', '/api/admin/reveal', { token: co })).status, 403);
  assert.equal((await call('GET', '/api/admin/export.csv', { token: co })).status, 403);
});

test('Co-Admin "covered": Namen verdeckt, einzeln oder alle aufdeckbar', async () => {
  const { call, co } = await withCoAdmin('covered');
  const state = (await call('GET', '/api/admin/state', { token: co })).body;
  assert.equal(state.assignmentsVisibility, 'covered');
  assert.ok(state.assignments.every((a) => a.receiver === undefined));
  assert.ok(state.drawId);

  const one = await call('POST', '/api/admin/reveal', { token: co, body: { giverId: state.assignments[0].giverId } });
  assert.equal(one.status, 200);
  assert.equal(one.body.assignments.length, 1);
  assert.ok(one.body.assignments[0].receiver);
  assert.equal(one.body.drawId, state.drawId);

  const all = await call('POST', '/api/admin/reveal', { token: co });
  assert.equal(all.body.assignments.length, 3);
  assert.equal((await call('GET', '/api/admin/export.csv', { token: co })).status, 200);
});

test('Co-Admin kann sonst alles, aber nicht den Co-Admin verwalten', async () => {
  const { call, co } = await withCoAdmin('hidden');
  assert.equal((await call('POST', '/api/admin/draw/redraw', { token: co })).status, 200);
  assert.equal((await call('POST', '/api/admin/draw/reset', { token: co })).status, 200);
  assert.equal((await call('POST', '/api/admin/participants', { token: co, body: { name: 'Emil' } })).status, 200);
  assert.equal((await call('POST', '/api/admin/coadmin/password', { token: co })).status, 403);
  assert.equal((await call('PUT', '/api/admin/coadmin/visibility', { token: co, body: { visibility: 'covered' } })).status, 403);
  assert.equal((await call('DELETE', '/api/admin/coadmin', { token: co })).status, 403);
});

test('Hauptadmin ändert die Sichtbarkeit, das wirkt sofort', async () => {
  const { call, main, co } = await withCoAdmin('hidden');
  assert.equal((await call('POST', '/api/admin/reveal', { token: co })).status, 403);
  await call('PUT', '/api/admin/coadmin/visibility', { token: main, body: { visibility: 'covered' } });
  assert.equal((await call('POST', '/api/admin/reveal', { token: co })).status, 200);
  assert.equal((await call('PUT', '/api/admin/coadmin/visibility', { token: main, body: { visibility: 'egal' } })).status, 400);
});

test('neues Co-Admin-Passwort oder Entfernen meldet den Co-Admin ab', async () => {
  const { call, main, co, coPassword } = await withCoAdmin('hidden');
  await call('POST', '/api/admin/coadmin/password', { token: main });
  assert.equal((await call('GET', '/api/admin/state', { token: co })).status, 401);
  assert.equal((await call('POST', '/api/admin/login', { body: { password: coPassword } })).status, 401);

  const custom = await call('POST', '/api/admin/coadmin/password', { token: main, body: { password: 'mein-co-passwort' } });
  assert.equal(custom.body.newCoAdminPassword, 'mein-co-passwort');
  const coToken = (await call('POST', '/api/admin/login', { body: { password: 'mein-co-passwort' } })).body.token;
  const removed = await call('DELETE', '/api/admin/coadmin', { token: main });
  assert.equal(removed.body.coAdmin.enabled, false);
  assert.equal((await call('GET', '/api/admin/state', { token: coToken })).status, 401);
  assert.equal((await call('POST', '/api/admin/login', { body: { password: 'mein-co-passwort' } })).status, 401);
});

test('Co-Admin-Passwort: zu kurz oder gleich dem Hauptpasswort wird abgelehnt', async () => {
  const { call, adminLogin } = await start();
  const main = await adminLogin();
  assert.equal((await call('POST', '/api/admin/coadmin/password', { token: main, body: { password: 'kurz' } })).status, 400);
  assert.equal(
    (await call('POST', '/api/admin/coadmin/password', { token: main, body: { password: ADMIN_PASSWORD } })).status,
    400,
  );
});

test('Event-Infos ändern und auf der Teilnehmerseite sehen', async () => {
  const { call, adminLogin } = await start();
  const token = await adminLogin();
  const res = await call('PUT', '/api/admin/event', {
    token,
    body: { title: 'Weihnachten 2026', budget: '25 €', date: '19.12.', location: 'Bei Anna' },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.event.title, 'Weihnachten 2026');
  assert.equal((await call('PUT', '/api/admin/event', { token, body: { title: ' ' } })).status, 400);

  const session = await call('GET', '/api/session');
  assert.deepEqual(session.body.event, { title: 'Weihnachten 2026', budget: '25 €', date: '19.12.', location: 'Bei Anna' });
});
