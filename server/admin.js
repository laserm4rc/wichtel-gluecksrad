import express from 'express';
import {
  LoginLimiter,
  checkAdminPassword,
  createAdminToken,
  getBearerToken,
  hashSecret,
  readAdminToken,
  verifySecret,
} from './auth.js';
import { generateAdminPassword } from './codes.js';
import { StoreError } from './db.js';

export const ADMIN_TOKEN_HEADER = 'x-admin-token';

/**
 * Alle Admin-Endpunkte unter /api/admin.
 *
 * Zwei Rollen:
 * - "main": Hauptadmin mit ADMIN_PASSWORD. Sieht alles und verwaltet den Co-Admin.
 * - "co":   Co-Admin mit eigenem Passwort. Kann alles andere auch, sieht die Zuteilung aber
 *           je nach Einstellung gar nicht ("hidden") oder nur verdeckt ("covered").
 *
 * Ohne ADMIN_PASSWORD bleibt der Web-Admin komplett gesperrt, auch für den Co-Admin.
 */
export function createAdminRouter({ store, config, secret }) {
  const router = express.Router();
  const limiter = new LoginLimiter({ limit: 5 });

  const credentials = () => ({ main: config.adminPassword, co: store.getCoAdmin().hash });
  const issueToken = (role) => createAdminToken(secret, role, credentials()[role]);

  router.post('/login', (req, res) => {
    if (!config.adminPassword) {
      return res.status(503).json({ error: 'Der Admin-Bereich ist gesperrt, weil ADMIN_PASSWORD nicht gesetzt ist.' });
    }
    if (limiter.isBlocked(req.ip)) {
      return res.status(429).json({ error: 'Zu viele Fehlversuche. Bitte warte ein paar Minuten.' });
    }
    const input = req.body?.password;
    const coAdmin = store.getCoAdmin();
    let role = null;
    if (checkAdminPassword(config.adminPassword, input)) role = 'main';
    else if (coAdmin.enabled && verifySecret(coAdmin.hash, input)) role = 'co';

    if (!role) {
      limiter.recordFailure(req.ip);
      return res.status(401).json({ error: 'Falsches Admin-Passwort.' });
    }
    limiter.recordSuccess(req.ip);
    res.json({ token: issueToken(role), role });
  });

  // Ab hier nur mit gültigem Admin-Schlüssel.
  // Jede Anfrage bekommt einen frischen Schlüssel zurück: So läuft die Sitzung erst nach 30 Minuten Untätigkeit ab.
  router.use((req, res, next) => {
    if (!config.adminPassword) return res.status(401).json({ error: 'Der Admin-Bereich ist gesperrt.' });
    const role = readAdminToken(secret, credentials(), getBearerToken(req));
    if (!role) return res.status(401).json({ error: 'Bitte melde dich als Admin an.' });
    req.adminRole = role;
    res.setHeader(ADMIN_TOKEN_HEADER, issueToken(role));
    next();
  });

  const requireMain = (req, res, next) => {
    if (req.adminRole === 'main') return next();
    res.status(403).json({ error: 'Das darf nur der Hauptadmin.' });
  };

  /** Was diese Rolle von der Zuteilung sehen darf: "visible", "covered" oder "hidden". */
  const visibilityFor = (role) => (role === 'main' ? 'visible' : store.getCoAdmin().visibility);

  /** Kompletter Stand für die Admin-Seite. Nach jeder Änderung wird er neu mitgeschickt. */
  const state = (role) => {
    const visibility = visibilityFor(role);
    const assignments = store.listAssignments();
    const spunByGiver = new Map(assignments.map((a) => [a.giverId, a.spunAt]));
    const coAdmin = store.getCoAdmin();
    return {
      role,
      assignmentsVisibility: visibility,
      event: store.getEvent(config.eventDefaults),
      baseUrl: config.baseUrl,
      phase: store.getPhase(),
      drawId: store.getDrawId(),
      participants: store.listParticipants().map((p) => ({ ...p, spunAt: spunByGiver.get(p.id) ?? null })),
      exclusions: store.listExclusions().map(([a, b]) => ({ a, b })),
      // Wer wen hat, verlässt den Server nur, wenn diese Rolle es sehen darf
      assignments: assignments.map((a) =>
        visibility === 'visible' ? a : { giverId: a.giverId, giver: a.giver, spunAt: a.spunAt },
      ),
      // Einstellungen zum Co-Admin sieht nur der Hauptadmin
      coAdmin: role === 'main' ? { enabled: coAdmin.enabled, visibility: coAdmin.visibility } : undefined,
    };
  };

  /**
   * Führt eine Änderung aus und antwortet mit dem neuen Stand. Fehler aus der Datenbank werden zu 400.
   * Gibt `fn` ein Objekt zurück, wird es mitgeschickt (z. B. ein neu erzeugtes Co-Admin-Passwort).
   */
  const mutate = (fn) => (req, res) => {
    try {
      const extra = fn(req);
      res.json({ ...state(req.adminRole), ...extra });
    } catch (err) {
      if (err instanceof StoreError) return res.status(400).json({ error: err.message });
      throw err;
    }
  };

  const id = (value) => Number.parseInt(value, 10);

  router.get('/state', (req, res) => res.json(state(req.adminRole)));

  router.post(
    '/participants',
    mutate((req) => {
      store.addParticipant(req.body?.name, req.body?.password || undefined);
    }),
  );
  router.delete('/participants/:id', mutate((req) => store.removeParticipant(id(req.params.id))));
  router.post(
    '/participants/:id/password',
    mutate((req) => {
      store.resetPassword(id(req.params.id), req.body?.password || undefined);
    }),
  );

  router.post('/exclusions', mutate((req) => store.addExclusion(id(req.body?.a), id(req.body?.b))));
  router.delete('/exclusions/:a/:b', mutate((req) => store.removeExclusion(id(req.params.a), id(req.params.b))));

  router.post('/draw/start', mutate(() => store.startDraw()));
  router.post('/draw/reset', mutate(() => store.resetDraw()));
  /** Neu auslosen: alte Zuteilung verwerfen und sofort eine neue berechnen. */
  router.post(
    '/draw/redraw',
    mutate(() => {
      store.db.transaction(() => {
        store.resetDraw();
        store.startDraw();
      })();
    }),
  );

  /**
   * Verdeckte Namen aufdecken (Co-Admin mit "covered"). Ohne giverId werden alle aufgedeckt.
   * Beim Hauptadmin funktioniert es auch, er sieht die Namen aber ohnehin.
   */
  router.post('/reveal', (req, res) => {
    if (visibilityFor(req.adminRole) === 'hidden') {
      return res.status(403).json({ error: 'Die Zuteilung ist für dich ausgeblendet.' });
    }
    const giverId = req.body?.giverId === undefined ? undefined : id(req.body.giverId);
    const assignments = store
      .listAssignments()
      .filter((a) => giverId === undefined || a.giverId === giverId)
      .map(({ giverId: g, receiverId, receiver }) => ({ giverId: g, receiverId, receiver }));
    res.json({ drawId: store.getDrawId(), assignments });
  });

  router.put('/event', mutate((req) => store.setEvent(req.body ?? {})));

  // ---------- Co-Admin (nur Hauptadmin) ----------

  /** Setzt oder erneuert das Passwort des Co-Admins. Ohne Vorgabe wird eins erzeugt und einmalig zurückgegeben. */
  router.post(
    '/coadmin/password',
    requireMain,
    mutate((req) => {
      const custom = String(req.body?.password ?? '').trim();
      if (custom && custom.length < 8) throw new StoreError('Das Co-Admin-Passwort muss mindestens 8 Zeichen haben.');
      if (custom && checkAdminPassword(config.adminPassword, custom)) {
        throw new StoreError('Das Co-Admin-Passwort darf nicht dein eigenes Admin-Passwort sein.');
      }
      const password = custom || generateAdminPassword();
      store.setCoAdminHash(hashSecret(password));
      return { newCoAdminPassword: password };
    }),
  );
  router.put('/coadmin/visibility', requireMain, mutate((req) => store.setCoAdminVisibility(req.body?.visibility)));
  router.delete('/coadmin', requireMain, mutate(() => store.removeCoAdmin()));

  router.get('/export.csv', (req, res) => {
    const visibility = visibilityFor(req.adminRole);
    if (visibility === 'hidden') return res.status(403).json({ error: 'Die Zuteilung ist für dich ausgeblendet.' });
    const rows = [['Schenkt', 'Beschenkt', 'Passwort', 'Gedreht am']];
    const passwords = new Map(store.listParticipants().map((p) => [p.id, p.password]));
    for (const a of store.listAssignments()) {
      rows.push([a.giver, a.receiver, passwords.get(a.giverId) ?? '', a.spunAt ?? '']);
    }
    // Semikolon und BOM, damit Excel die Datei mit Umlauten richtig öffnet
    const csv = '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n') + '\r\n';
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', 'attachment; filename="wichtel-zuteilung.csv"');
    res.send(csv);
  });

  return router;
}

function csvCell(value) {
  const text = String(value);
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
