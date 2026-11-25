import fs from 'node:fs';
import path from 'node:path';

// Für die lokale Entwicklung: Variablen aus einer .env-Datei laden (falls vorhanden).
// Auf Pelican kommen sie aus den Egg-Variablen, SERVER_PORT aus der Allocation.
if (fs.existsSync('.env')) process.loadEnvFile('.env');

const env = process.env;

export const config = {
  port: Number(env.SERVER_PORT || env.PORT || 3000),
  host: env.HOST || '0.0.0.0',
  dataDir: path.resolve(env.DATA_DIR || 'data'),
  /** Ohne ADMIN_PASSWORD ist der Web-Admin gesperrt, die Konsole funktioniert trotzdem. */
  adminPassword: env.ADMIN_PASSWORD || '',
  baseUrl: (env.BASE_URL || '').replace(/\/+$/, ''),
  /** Startwerte für die Event-Infos. Im Admin lassen sie sich danach ändern. */
  eventDefaults: {
    title: env.EVENT_TITLE || 'Wichteln',
    budget: env.BUDGET || '',
    date: env.EVENT_DATE || '',
    location: env.EVENT_LOCATION || '',
  },
};
