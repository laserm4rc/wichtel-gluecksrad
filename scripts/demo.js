// Nur für die lokale Entwicklung, bis es den Admin-Bereich gibt (Schritt 2):
// legt Beispiel-Teilnehmer an, startet die Ziehung und zeigt die Passwörter.
//
//   npm run demo            Beispieldaten anlegen (falls noch leer) und auslosen
//   npm run demo -- --reset  alles löschen und neu anlegen
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../server/config.js';
import { openDatabase } from '../server/db.js';

const file = path.join(config.dataDir, 'wichtel.db');
if (process.argv.includes('--reset')) {
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(file + suffix, { force: true });
}

const store = openDatabase(file);
if (store.listParticipants().length === 0) {
  for (const name of ['Anna', 'Ben', 'Clara', 'David', 'Emma', 'Finn', 'Greta']) store.addParticipant(name);
  const [anna, ben] = store.listParticipants();
  store.addExclusion(anna.id, ben.id); // Beispiel: Anna und Ben sind ein Paar
}
if (store.getPhase() === 'setup') store.startDraw();

console.log('\nPasswörter:');
console.table(store.listParticipants().map(({ name, password }) => ({ name, password })));
console.log('Zuteilung:');
console.table(store.listAssignments().map(({ giver, receiver, spunAt }) => ({ giver, receiver, gedreht: spunAt ?? '–' })));
store.close();
