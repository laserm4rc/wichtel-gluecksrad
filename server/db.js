import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { computeAssignment, DrawError } from './draw.js';
import { PASSWORD_PATTERN, generatePassword, normalizePassword } from './codes.js';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS participants (
    id            INTEGER PRIMARY KEY,
    name          TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password      TEXT NOT NULL,            -- so wie es der Admin weitergibt, z. B. "tanne-zimt-472"
    password_key  TEXT NOT NULL UNIQUE,     -- kleingeschriebene Form für den Login-Vergleich
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    first_login_at TEXT,                    -- erste Anmeldung mit dem aktuellen Passwort
    last_login_at  TEXT,
    login_count    INTEGER NOT NULL DEFAULT 0
  );

  -- Paare, die sich gegenseitig nicht ziehen dürfen (immer a < b gespeichert)
  CREATE TABLE IF NOT EXISTS exclusions (
    a INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    b INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    PRIMARY KEY (a, b),
    CHECK (a < b)
  );

  CREATE TABLE IF NOT EXISTS assignments (
    giver_id     INTEGER PRIMARY KEY REFERENCES participants(id) ON DELETE CASCADE,
    receiver_id  INTEGER NOT NULL UNIQUE REFERENCES participants(id) ON DELETE CASCADE,
    spun_at      TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL
  );
`;

/**
 * Öffnet (oder erstellt) die Datenbank.
 * @param {string} file  Pfad zur SQLite-Datei oder ":memory:" für Tests
 */
export function openDatabase(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  migrate(db);
  return new Store(db);
}

/** Ergänzt Spalten, die in älteren Datenbanken noch fehlen. */
function migrate(db) {
  const columns = new Set(db.prepare('PRAGMA table_info(participants)').all().map((c) => c.name));
  if (!columns.has('first_login_at')) db.exec('ALTER TABLE participants ADD COLUMN first_login_at TEXT');
  if (!columns.has('last_login_at')) db.exec('ALTER TABLE participants ADD COLUMN last_login_at TEXT');
  if (!columns.has('login_count')) db.exec('ALTER TABLE participants ADD COLUMN login_count INTEGER NOT NULL DEFAULT 0');
}

export class StoreError extends Error {}

const EVENT_FIELDS = ['title', 'budget', 'date', 'location'];
export const COADMIN_VISIBILITY = ['hidden', 'covered'];

/** Alle Datenbankzugriffe an einer Stelle. better-sqlite3 arbeitet synchron, dadurch gibt es keine Wettläufe. */
export class Store {
  constructor(db) {
    this.db = db;
  }

  close() {
    this.db.close();
  }

  // ---------- Einstellungen ----------

  getSetting(key) {
    return this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value;
  }

  setSetting(key, value) {
    this.db
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, String(value));
  }

  /** Geheimer Schlüssel zum Signieren der Login-Cookies. Wird einmalig erzeugt und bleibt über Neustarts erhalten. */
  getSessionSecret() {
    let secret = this.getSetting('session_secret');
    if (!secret) {
      secret = crypto.randomBytes(32).toString('hex');
      this.setSetting('session_secret', secret);
    }
    return secret;
  }

  // ---------- Event-Infos ----------

  /** Titel, Budget, Datum, Ort. Was im Admin nicht gesetzt wurde, kommt aus den Egg-Variablen. */
  getEvent(defaults = {}) {
    const event = {};
    for (const key of EVENT_FIELDS) event[key] = this.getSetting(`event_${key}`) ?? defaults[key] ?? '';
    return event;
  }

  setEvent(values) {
    const title = String(values.title ?? '').trim();
    if (!title) throw new StoreError('Der Titel darf nicht leer sein.');
    this.db.transaction(() => {
      for (const key of EVENT_FIELDS) {
        this.setSetting(`event_${key}`, String(values[key] ?? '').trim().slice(0, 200));
      }
    })();
  }

  // ---------- Co-Admin ----------

  /**
   * Zweiter Admin. `visibility` legt fest, was er von der Zuteilung sieht:
   * "hidden" = gar nichts, "covered" = verdeckt, muss aktiv aufgedeckt werden.
   */
  getCoAdmin() {
    const hash = this.getSetting('coadmin_hash');
    const visibility = this.getSetting('coadmin_visibility');
    return {
      enabled: Boolean(hash),
      hash,
      visibility: COADMIN_VISIBILITY.includes(visibility) ? visibility : 'hidden',
    };
  }

  setCoAdminHash(hash) {
    this.setSetting('coadmin_hash', hash);
  }

  setCoAdminVisibility(visibility) {
    if (!COADMIN_VISIBILITY.includes(visibility)) throw new StoreError('Sichtbarkeit muss "hidden" oder "covered" sein.');
    this.setSetting('coadmin_visibility', visibility);
  }

  removeCoAdmin() {
    this.db.prepare("DELETE FROM settings WHERE key = 'coadmin_hash'").run();
  }

  // ---------- Teilnehmer ----------

  listParticipants() {
    return this.db
      .prepare(`
        SELECT id, name, password,
               first_login_at AS firstLoginAt, last_login_at AS lastLoginAt, login_count AS loginCount
        FROM participants ORDER BY name COLLATE NOCASE
      `)
      .all();
  }

  /** Merkt sich, dass die Person ihr Passwort benutzt hat (für die Übersicht im Admin). */
  recordLogin(id) {
    this.db
      .prepare(`
        UPDATE participants
        SET first_login_at = COALESCE(first_login_at, datetime('now')),
            last_login_at = datetime('now'),
            login_count = login_count + 1
        WHERE id = ?
      `)
      .run(id);
  }

  getParticipant(id) {
    return this.db.prepare('SELECT id, name, password, password_key FROM participants WHERE id = ?').get(id);
  }

  /** Groß-/Kleinschreibung egal, für die Konsolenbefehle. */
  findByName(name) {
    return this.db.prepare('SELECT id, name, password FROM participants WHERE name = ?').get(String(name ?? '').trim());
  }

  findByPassword(input) {
    const key = normalizePassword(input);
    if (!key) return undefined;
    return this.db.prepare('SELECT id, name, password_key FROM participants WHERE password_key = ?').get(key);
  }

  /** Legt eine Person an. Ohne Passwort wird eines erzeugt. */
  addParticipant(name, password) {
    this.#assertNotDrawn('Teilnehmer können nach der Ziehung nicht mehr hinzugefügt werden.');
    const cleanName = String(name ?? '').trim();
    if (!cleanName) throw new StoreError('Der Name darf nicht leer sein.');
    if (this.db.prepare('SELECT 1 FROM participants WHERE name = ?').get(cleanName)) {
      throw new StoreError(`„${cleanName}“ ist schon in der Liste.`);
    }
    const pw = this.#uniquePassword(password);
    const info = this.db
      .prepare('INSERT INTO participants (name, password, password_key) VALUES (?, ?, ?)')
      .run(cleanName, pw, normalizePassword(pw));
    return this.getParticipant(Number(info.lastInsertRowid));
  }

  removeParticipant(id) {
    this.#assertNotDrawn('Teilnehmer können nach der Ziehung nicht mehr entfernt werden.');
    const info = this.db.prepare('DELETE FROM participants WHERE id = ?').run(id);
    if (info.changes === 0) throw new StoreError('Diese Person gibt es nicht.');
  }

  /** Vergibt ein neues Passwort. Bestehende Anmeldungen dieser Person werden dadurch ungültig. */
  resetPassword(id, password) {
    if (!this.getParticipant(id)) throw new StoreError('Diese Person gibt es nicht.');
    const pw = this.#uniquePassword(password, id);
    this.db
      // Neues Passwort = noch nicht benutzt, die Login-Übersicht beginnt von vorn
      .prepare(`
        UPDATE participants
        SET password = ?, password_key = ?, first_login_at = NULL, last_login_at = NULL, login_count = 0
        WHERE id = ?
      `)
      .run(pw, normalizePassword(pw), id);
    return this.getParticipant(id);
  }

  #uniquePassword(password, ownId) {
    if (password !== undefined && password !== null && password !== '') {
      const key = normalizePassword(password);
      const pw = key;
      if (!PASSWORD_PATTERN.test(key)) {
        throw new StoreError('Das Passwort darf nur Buchstaben, Ziffern und Bindestriche enthalten, keine Leerzeichen (z. B. tanne-zimt-472).');
      }
      if (key.replace(/-/g, '').length < 4) throw new StoreError('Das Passwort ist zu kurz (mindestens 4 Buchstaben oder Ziffern).');
      const other = this.db.prepare('SELECT id FROM participants WHERE password_key = ?').get(key);
      if (other && other.id !== ownId) throw new StoreError('Dieses Passwort ist schon vergeben.');
      return pw;
    }
    for (;;) {
      const pw = generatePassword();
      if (!this.db.prepare('SELECT 1 FROM participants WHERE password_key = ?').get(normalizePassword(pw))) return pw;
    }
  }

  // ---------- Ausschlüsse ----------

  listExclusions() {
    return this.db.prepare('SELECT a, b FROM exclusions').all().map(({ a, b }) => [a, b]);
  }

  addExclusion(id1, id2) {
    this.#assertNotDrawn('Ausschlüsse können nach der Ziehung nicht mehr geändert werden.');
    if (id1 === id2) throw new StoreError('Eine Person kann sich nicht selbst ausschließen.');
    const [a, b] = id1 < id2 ? [id1, id2] : [id2, id1];
    this.db.prepare('INSERT OR IGNORE INTO exclusions (a, b) VALUES (?, ?)').run(a, b);
  }

  removeExclusion(id1, id2) {
    this.#assertNotDrawn('Ausschlüsse können nach der Ziehung nicht mehr geändert werden.');
    const [a, b] = id1 < id2 ? [id1, id2] : [id2, id1];
    this.db.prepare('DELETE FROM exclusions WHERE a = ? AND b = ?').run(a, b);
  }

  // ---------- Ziehung ----------

  /** "setup" = Teilnehmer werden noch eingetragen, "open" = Zuteilung steht fest, es darf gedreht werden. */
  getPhase() {
    return this.db.prepare('SELECT 1 FROM assignments LIMIT 1').get() ? 'open' : 'setup';
  }

  /** Berechnet die komplette Zuteilung und speichert sie. Ab dann kann jede Person drehen. */
  startDraw() {
    this.#assertNotDrawn('Die Ziehung läuft bereits.');
    const ids = this.listParticipants().map((p) => p.id);
    let assignment;
    try {
      assignment = computeAssignment(ids, this.listExclusions());
    } catch (err) {
      if (err instanceof DrawError) throw new StoreError(err.message);
      throw err;
    }
    const insert = this.db.prepare('INSERT INTO assignments (giver_id, receiver_id) VALUES (?, ?)');
    this.db.transaction(() => {
      for (const [giver, receiver] of assignment) insert.run(giver, receiver);
      // Neue Kennung pro Auslosung, damit die Admin-Seite aufgedeckte Namen nach einem Neu-Auslosen wieder verdeckt
      this.setSetting('draw_id', crypto.randomBytes(8).toString('hex'));
    })();
  }

  getDrawId() {
    return this.getPhase() === 'open' ? (this.getSetting('draw_id') ?? null) : null;
  }

  /** Löscht die Zuteilung. Danach kann neu ausgelost werden. */
  resetDraw() {
    this.db.prepare('DELETE FROM assignments').run();
  }

  /** Für den Admin: wer wen hat und wer schon gedreht hat. */
  listAssignments() {
    return this.db
      .prepare(`
        SELECT g.id AS giverId, g.name AS giver, r.id AS receiverId, r.name AS receiver, a.spun_at AS spunAt
        FROM assignments a
        JOIN participants g ON g.id = a.giver_id
        JOIN participants r ON r.id = a.receiver_id
        ORDER BY g.name COLLATE NOCASE
      `)
      .all();
  }

  /** Ergebnis einer Person, ohne es aufzudecken. */
  getAssignment(giverId) {
    return this.db
      .prepare(`
        SELECT r.name AS receiver, a.spun_at AS spunAt
        FROM assignments a JOIN participants r ON r.id = a.receiver_id
        WHERE a.giver_id = ?
      `)
      .get(giverId);
  }

  /**
   * Die Person dreht. Beim ersten Mal wird der Zeitpunkt gespeichert,
   * danach liefert der Aufruf immer dasselbe Ergebnis.
   */
  spin(giverId) {
    const assignment = this.getAssignment(giverId);
    if (!assignment) throw new StoreError('Die Ziehung wurde noch nicht gestartet.');
    if (!assignment.spunAt) {
      this.db.prepare("UPDATE assignments SET spun_at = datetime('now') WHERE giver_id = ? AND spun_at IS NULL").run(giverId);
    }
    return this.getAssignment(giverId);
  }

  #assertNotDrawn(message) {
    if (this.getPhase() !== 'setup') throw new StoreError(message);
  }
}
