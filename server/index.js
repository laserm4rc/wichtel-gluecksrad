import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { openDatabase } from './db.js';
import { createApp } from './app.js';
import { startConsole } from './console.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const store = openDatabase(path.join(config.dataDir, 'wichtel.db'));
const staticDir = path.join(rootDir, 'dist');
if (!fs.existsSync(path.join(staticDir, 'index.html'))) {
  console.warn('Achtung: Die Oberfläche ist nicht gebaut (dist/ fehlt). Lokal: npm run build. Auf Pelican: Server neu installieren.');
}
const app = createApp({ store, config, staticDir });

const server = app.listen(config.port, config.host, () => {
  const url = config.baseUrl || `http://localhost:${config.port}`;
  console.log(`Wichtel-Glücksrad „${store.getEvent(config.eventDefaults).title}“ läuft auf ${url}`);
  console.log(config.adminPassword ? `Admin: ${url}/admin` : 'Web-Admin gesperrt: ADMIN_PASSWORD ist nicht gesetzt.');
  startConsole({ store, config, onStop: shutdown });
});

function shutdown() {
  console.log('Wird beendet …');
  server.close(() => {
    store.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
