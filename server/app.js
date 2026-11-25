import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { LoginLimiter, createToken, getBearerToken, readToken } from './auth.js';
import { StoreError } from './db.js';
import { createAdminRouter } from './admin.js';

/**
 * Baut die Express-App. Bekommt Datenbank und Konfiguration übergeben,
 * damit sie sich auch in Tests starten lässt.
 */
export function createApp({ store, config, staticDir }) {
  const app = express();
  const secret = store.getSessionSecret();
  const limiter = new LoginLimiter();

  // Hinter einem Reverse Proxy (Caddy, nginx, Cloudflare Tunnel) die echte Client-IP verwenden
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));

  const currentUser = (req) => readToken(secret, store, getBearerToken(req));

  // ---------- API für Teilnehmer ----------

  /** Alles, was die Seite beim Laden braucht. */
  app.get('/api/session', (req, res) => {
    const user = currentUser(req);
    const body = {
      event: store.getEvent(config.eventDefaults),
      phase: store.getPhase(),
      user: null,
    };
    if (user) {
      const assignment = store.getAssignment(user.id);
      body.user = {
        name: user.name,
        // Das Rad zeigt alle anderen Namen. Es ist nur Animation, die Zuteilung steht schon fest.
        wheel: store
          .listParticipants()
          .filter((p) => p.id !== user.id)
          .map((p) => p.name),
        spun: Boolean(assignment?.spunAt),
        // Das Ergebnis steht hier bewusst nicht drin: Man sieht es nur über /api/spin,
        // also erst nach dem Drehen, und zwar bei jedem Besuch aufs Neue.
      };
    }
    res.json(body);
  });

  app.post('/api/login', (req, res) => {
    const ip = req.ip;
    if (limiter.isBlocked(ip)) {
      return res.status(429).json({ error: 'Zu viele Fehlversuche. Bitte warte ein paar Minuten.' });
    }
    const participant = store.findByPassword(req.body?.password);
    if (!participant) {
      limiter.recordFailure(ip);
      return res.status(401).json({ error: 'Dieses Passwort kennen wir nicht. Achte auf die Bindestriche.' });
    }
    limiter.recordSuccess(ip);
    store.recordLogin(participant.id);
    // Kein Cookie: Die Seite hält den Schlüssel nur im Speicher, nach einem Reload ist man abgemeldet
    res.json({ token: createToken(secret, participant) });
  });

  /** Drehen: liefert den vorbestimmten Namen. Mehrfaches Drehen ergibt immer dasselbe. */
  app.post('/api/spin', (req, res) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ error: 'Bitte melde dich zuerst an.' });
    try {
      const assignment = store.spin(user.id);
      res.json({ receiver: assignment.receiver });
    } catch (err) {
      if (err instanceof StoreError) return res.status(409).json({ error: err.message });
      throw err;
    }
  });

  // ---------- API für den Admin ----------

  app.use('/api/admin', createAdminRouter({ store, config, secret }));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Nicht gefunden.' }));

  // ---------- Frontend ----------

  if (staticDir && fs.existsSync(path.join(staticDir, 'index.html'))) {
    app.use(express.static(staticDir, { index: false }));
    // Alle übrigen Seiten (z. B. später /admin) liefert die React-App selbst aus
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  app.use((err, req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Interner Fehler.' });
  });

  return app;
}
