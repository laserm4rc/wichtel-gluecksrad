import crypto from 'node:crypto';

/** Wie lange ein Anmeldeschlüssel höchstens gilt. Beim Neuladen der Seite ist er ohnehin weg. */
export const TOKEN_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 Stunden

/**
 * Anmeldeschlüssel: "<id>.<ausgestellt-um>.<signatur>".
 *
 * Die Seite hält ihn nur im Arbeitsspeicher (kein Cookie, kein localStorage).
 * Nach jedem Neuladen muss man sich deshalb wieder anmelden.
 * Die Signatur hängt auch vom Passwort ab: Vergibt der Admin ein neues Passwort,
 * werden alle alten Schlüssel dieser Person ungültig.
 */
export function createToken(secret, participant, now = Date.now()) {
  return `${participant.id}.${now}.${sign(secret, participant, now)}`;
}

/** Liefert die angemeldete Person oder undefined. */
export function readToken(secret, store, token, now = Date.now()) {
  const match = /^(\d+)\.(\d+)\.([a-f0-9]{64})$/.exec(token ?? '');
  if (!match) return undefined;
  const issuedAt = Number(match[2]);
  if (!(issuedAt <= now && now - issuedAt < TOKEN_MAX_AGE_MS)) return undefined;
  const participant = store.getParticipant(Number(match[1]));
  if (!participant) return undefined;
  const expected = Buffer.from(sign(secret, participant, issuedAt), 'hex');
  const given = Buffer.from(match[3], 'hex');
  return crypto.timingSafeEqual(expected, given) ? participant : undefined;
}

function sign(secret, participant, issuedAt) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${participant.id}:${issuedAt}:${participant.password_key}`)
    .digest('hex');
}

// ---------- Admin ----------

/**
 * Admin-Sitzung: bleibt über einen Reload erhalten (die Seite speichert den Schlüssel),
 * läuft aber nach so langer Untätigkeit ab. Jede Admin-Anfrage verlängert sie.
 */
export const ADMIN_IDLE_MS = 30 * 60 * 1000; // 30 Minuten

/** Vergleicht das eingegebene Admin-Passwort mit ADMIN_PASSWORD (in konstanter Zeit). */
export function checkAdminPassword(adminPassword, input) {
  if (!adminPassword) return false;
  const a = crypto.createHash('sha256').update(String(input ?? '')).digest();
  const b = crypto.createHash('sha256').update(adminPassword).digest();
  return crypto.timingSafeEqual(a, b);
}

/** Passwort-Hash für den Co-Admin (scrypt mit Salt), gespeichert als "salt:hash". */
export function hashSecret(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function verifySecret(stored, input) {
  const [salt, hash] = String(stored ?? '').split(':');
  if (!salt || !hash) return false;
  const actual = crypto.scryptSync(String(input ?? ''), salt, 32);
  return crypto.timingSafeEqual(actual, Buffer.from(hash, 'hex'));
}

/**
 * Admin-Schlüssel: "admin.<rolle>.<ausgestellt-um>.<signatur>", Rolle "main" oder "co".
 * `credential` ist bei "main" ADMIN_PASSWORD, bei "co" der gespeicherte Passwort-Hash.
 * Ändert sich das jeweilige Passwort, sind alle alten Schlüssel dieser Rolle ungültig.
 */
export function createAdminToken(secret, role, credential, now = Date.now()) {
  return `admin.${role}.${now}.${signAdmin(secret, role, credential, now)}`;
}

/**
 * Prüft einen Admin-Schlüssel und liefert die Rolle ("main" | "co") oder null.
 * @param credentials  { main: ADMIN_PASSWORD, co: gespeicherter Hash oder undefined }
 */
export function readAdminToken(secret, credentials, token, now = Date.now()) {
  const match = /^admin\.(main|co)\.(\d+)\.([a-f0-9]{64})$/.exec(token ?? '');
  if (!match) return null;
  const [, role, issued, signature] = match;
  const credential = credentials[role];
  if (!credential) return null;
  const issuedAt = Number(issued);
  if (!(issuedAt <= now && now - issuedAt < ADMIN_IDLE_MS)) return null;
  const expected = Buffer.from(signAdmin(secret, role, credential, issuedAt), 'hex');
  return crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex')) ? role : null;
}

function signAdmin(secret, role, credential, issuedAt) {
  const credHash = crypto.createHash('sha256').update(credential).digest('hex');
  return crypto.createHmac('sha256', secret).update(`admin:${role}:${issuedAt}:${credHash}`).digest('hex');
}

/** Liest den Schlüssel aus dem Header "Authorization: Bearer <token>". */
export function getBearerToken(req) {
  const header = req.headers.authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
}

/**
 * Einfache Bremse gegen Passwort-Raten: höchstens `limit` Fehlversuche
 * pro IP-Adresse innerhalb von `windowMs`.
 */
export class LoginLimiter {
  constructor({ limit = 10, windowMs = 15 * 60 * 1000 } = {}) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.failures = new Map();
  }

  isBlocked(ip) {
    const entry = this.failures.get(ip);
    if (!entry) return false;
    if (entry.resetAt <= Date.now()) {
      this.failures.delete(ip);
      return false;
    }
    return entry.count >= this.limit;
  }

  recordFailure(ip) {
    const now = Date.now();
    const entry = this.failures.get(ip);
    if (!entry || entry.resetAt <= now) this.failures.set(ip, { count: 1, resetAt: now + this.windowMs });
    else entry.count++;
  }

  recordSuccess(ip) {
    this.failures.delete(ip);
  }
}
