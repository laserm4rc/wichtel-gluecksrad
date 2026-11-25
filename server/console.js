import readline from 'node:readline';
import { StoreError } from './db.js';
import { hashSecret } from './auth.js';
import { generateAdminPassword } from './codes.js';

/**
 * Admin-Befehle über die Pelican-Konsole (stdin).
 * Wer die Konsole sieht, ist schon über das Pelican-Panel angemeldet, deshalb ist hier kein Passwort nötig.
 */
const HELP = `
Befehle:
  status                          Überblick: Phase, Anmeldungen, gedreht
  list                            Alle Teilnehmer mit Passwort und Status
  add <Name> [passwort]           Person hinzufügen (ohne Passwort wird eins erzeugt)
  remove <Name>                   Person entfernen
  password <Name> [passwort]      Neues Passwort vergeben
  exclude <Name> <Name>           Zwei Personen dürfen sich nicht ziehen (z. B. Paare)
  include <Name> <Name>           Ausschluss wieder aufheben
  exclusions                      Alle Ausschlüsse anzeigen
  start                           Ziehung starten (Zuteilung wird berechnet)
  assignments                     Wer hat wen?
  redraw ja                       Neu auslosen (alte Zuteilung wird verworfen)
  reset ja                        Zuteilung löschen, zurück zur Teilnehmerliste
  event                           Event-Infos anzeigen
  event <title|budget|date|location> <Wert>   Event-Info ändern
  coadmin                         Co-Admin anzeigen
  coadmin password [passwort]     Co-Admin anlegen bzw. neues Passwort vergeben
  coadmin hidden | covered        Zuteilung für den Co-Admin ausblenden bzw. verdeckt zeigen
  coadmin remove                  Co-Admin entfernen
  stop                            Server beenden
Namen mit Leerzeichen in Anführungszeichen: add "Anna Maria"
`;

export function startConsole({ store, config, onStop }) {
  if (!process.stdin.readable) return;
  const rl = readline.createInterface({ input: process.stdin, terminal: false });

  rl.on('line', (line) => {
    const args = parseArgs(line);
    if (args.length === 0) return;
    try {
      run(args, { store, config, onStop });
    } catch (err) {
      if (err instanceof StoreError || err instanceof ConsoleError) console.log(`Fehler: ${err.message}`);
      else console.error(err);
    }
  });
  console.log('Konsole bereit. Tippe "help" für alle Befehle.');
}

class ConsoleError extends Error {}

function run([command, ...args], { store, config, onStop }) {
  const person = (name) => {
    if (!name) throw new ConsoleError('Bitte einen Namen angeben.');
    const p = store.findByName(name);
    if (!p) throw new ConsoleError(`„${name}“ gibt es nicht. "list" zeigt alle Namen.`);
    return p;
  };

  switch (command.toLowerCase()) {
    case 'help':
    case 'hilfe':
      console.log(HELP);
      break;

    case 'status': {
      const people = store.listParticipants();
      const assignments = store.listAssignments();
      const loggedIn = people.filter((p) => p.firstLoginAt).length;
      const spun = assignments.filter((a) => a.spunAt).length;
      console.log(`Event:      ${store.getEvent(config.eventDefaults).title}`);
      console.log(`Phase:      ${store.getPhase() === 'open' ? 'Ziehung läuft' : 'Teilnehmer eintragen'}`);
      console.log(`Teilnehmer: ${people.length}`);
      console.log(`Angemeldet: ${loggedIn} von ${people.length}`);
      if (assignments.length) console.log(`Gedreht:    ${spun} von ${assignments.length}`);
      break;
    }

    case 'list': {
      const people = store.listParticipants();
      if (people.length === 0) return console.log('Noch niemand eingetragen. Beispiel: add Anna');
      const spun = new Map(store.listAssignments().map((a) => [a.giverId, a.spunAt]));
      const width = Math.max(...people.map((p) => p.name.length));
      for (const p of people) {
        const login = p.firstLoginAt ? `angemeldet (${p.loginCount}x)` : 'noch nicht angemeldet';
        const spin = spun.has(p.id) ? (spun.get(p.id) ? ', gedreht' : ', noch nicht gedreht') : '';
        console.log(`${p.name.padEnd(width)}  ${p.password.padEnd(24)}  ${login}${spin}`);
      }
      break;
    }

    case 'add': {
      const p = store.addParticipant(args[0], args[1]);
      console.log(`${p.name} hinzugefügt. Passwort: ${p.password}`);
      break;
    }

    case 'remove': {
      const p = person(args[0]);
      store.removeParticipant(p.id);
      console.log(`${p.name} entfernt.`);
      break;
    }

    case 'password': {
      const p = store.resetPassword(person(args[0]).id, args[1]);
      console.log(`Neues Passwort für ${p.name}: ${p.password}`);
      break;
    }

    case 'exclude': {
      const [a, b] = [person(args[0]), person(args[1])];
      store.addExclusion(a.id, b.id);
      console.log(`${a.name} und ${b.name} ziehen sich nicht gegenseitig.`);
      break;
    }

    case 'include': {
      const [a, b] = [person(args[0]), person(args[1])];
      store.removeExclusion(a.id, b.id);
      console.log(`Ausschluss zwischen ${a.name} und ${b.name} aufgehoben.`);
      break;
    }

    case 'exclusions': {
      const names = new Map(store.listParticipants().map((p) => [p.id, p.name]));
      const list = store.listExclusions();
      if (list.length === 0) return console.log('Keine Ausschlüsse.');
      for (const [a, b] of list) console.log(`${names.get(a)} ✕ ${names.get(b)}`);
      break;
    }

    case 'start':
      store.startDraw();
      console.log('Ziehung gestartet. Ab jetzt kann jede Person drehen. "assignments" zeigt die Zuteilung.');
      break;

    case 'assignments': {
      const list = store.listAssignments();
      if (list.length === 0) return console.log('Noch keine Zuteilung. Mit "start" auslosen.');
      const width = Math.max(...list.map((a) => a.giver.length));
      for (const a of list) console.log(`${a.giver.padEnd(width)}  →  ${a.receiver}${a.spunAt ? '' : '   (noch nicht gedreht)'}`);
      break;
    }

    case 'redraw':
      if (args[0] !== 'ja') return console.log('Wirklich neu auslosen? Alle bisherigen Ergebnisse ändern sich. Bestätigen mit: redraw ja');
      store.resetDraw();
      store.startDraw();
      console.log('Neu ausgelost.');
      break;

    case 'reset':
      if (args[0] !== 'ja') return console.log('Wirklich die Zuteilung löschen? Bestätigen mit: reset ja');
      store.resetDraw();
      console.log('Zuteilung gelöscht. Die Teilnehmerliste kann wieder bearbeitet werden.');
      break;

    case 'event': {
      const event = store.getEvent(config.eventDefaults);
      if (args.length === 0) {
        for (const [key, value] of Object.entries(event)) console.log(`${key.padEnd(9)} ${value || '–'}`);
        return;
      }
      const [field, ...rest] = args;
      if (!(field in event)) throw new ConsoleError('Feld muss title, budget, date oder location sein.');
      store.setEvent({ ...event, [field]: rest.join(' ') });
      console.log(`${field} gespeichert.`);
      break;
    }

    case 'coadmin': {
      const [action, value] = args;
      const describe = (v) => (v === 'covered' ? 'verdeckt (muss aufgedeckt werden)' : 'ausgeblendet');
      if (!action) {
        const co = store.getCoAdmin();
        console.log(co.enabled ? `Co-Admin aktiv. Zuteilung: ${describe(co.visibility)}.` : 'Kein Co-Admin angelegt.');
      } else if (action === 'password') {
        const password = value?.trim() || generateAdminPassword();
        if (password.length < 8) throw new ConsoleError('Das Co-Admin-Passwort muss mindestens 8 Zeichen haben.');
        store.setCoAdminHash(hashSecret(password));
        console.log(`Co-Admin-Passwort: ${password}  (wird nur jetzt angezeigt)`);
      } else if (action === 'hidden' || action === 'covered') {
        store.setCoAdminVisibility(action);
        console.log(`Zuteilung für den Co-Admin: ${describe(action)}.`);
      } else if (action === 'remove') {
        store.removeCoAdmin();
        console.log('Co-Admin entfernt.');
      } else {
        throw new ConsoleError('Unbekannt. Möglich: coadmin, coadmin password, coadmin hidden, coadmin covered, coadmin remove');
      }
      break;
    }

    case 'stop':
    case 'exit':
      onStop?.();
      break;

    default:
      console.log(`Unbekannter Befehl „${command}“. Tippe "help" für alle Befehle.`);
  }
}

/** Zerlegt eine Zeile in Wörter, "Text in Anführungszeichen" bleibt zusammen. */
export function parseArgs(line) {
  const args = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(line))) args.push(m[1] ?? m[2] ?? m[3]);
  return args;
}
