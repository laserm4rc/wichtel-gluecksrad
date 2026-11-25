// Erzeugt das Pelican-Egg (Format PLCN_v3, YAML) aus pelican/install.sh.
//
//   npm run egg -- --repo https://github.com/<name>/<repo> [--author <email>]
//
// Ergebnis: pelican/egg-wichtel-gluecksrad.yaml – im Panel unter Admin → Eggs → Importieren hochladen.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};

const repo = arg('repo');
if (!repo) {
  console.error('Bitte die Repo-Adresse angeben: npm run egg -- --repo https://github.com/<name>/<repo>');
  process.exit(1);
}
const author = arg('author', 'wichtel@example.com');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const installScript = fs.readFileSync(path.join(root, 'pelican', 'install.sh'), 'utf8').replace(/\r\n/g, '\n');

// Feste UUID, damit ein erneuter Import das bestehende Egg aktualisiert statt ein zweites anzulegen
const UUID = '44b56edb-47ab-4617-a9c1-df90c82b32cf';

const variables = [
  {
    name: 'Admin-Passwort',
    description: 'Passwort für den Admin-Bereich unter /admin. Ohne Passwort ist der Web-Admin gesperrt (die Konsole funktioniert trotzdem).',
    env_variable: 'ADMIN_PASSWORD',
    default_value: '',
    rules: ['required', 'string', 'min:8', 'max:128'],
  },
  {
    name: 'Event-Titel',
    description: 'Startwert für den Titel. Lässt sich danach im Admin unter „Event“ ändern, dann gilt der Wert aus dem Admin.',
    env_variable: 'EVENT_TITLE',
    default_value: 'Wichteln',
    rules: ['required', 'string', 'max:100'],
  },
  {
    name: 'Budget',
    description: 'Optional, z. B. „25 €“. Startwert, im Admin änderbar.',
    env_variable: 'BUDGET',
    default_value: '',
    rules: ['nullable', 'string', 'max:50'],
  },
  {
    name: 'Datum',
    description: 'Optional, z. B. „Fr, 19.12., 18 Uhr“. Startwert, im Admin änderbar.',
    env_variable: 'EVENT_DATE',
    default_value: '',
    rules: ['nullable', 'string', 'max:100'],
  },
  {
    name: 'Ort',
    description: 'Optional, z. B. „bei Anna“. Startwert, im Admin änderbar.',
    env_variable: 'EVENT_LOCATION',
    default_value: '',
    rules: ['nullable', 'string', 'max:100'],
  },
  {
    name: 'Öffentliche Adresse',
    description: 'Adresse, unter der die Seite erreichbar ist, z. B. https://wichteln.example.de. Wird in Einladungen verwendet. Leer = Adresse aus dem Browser.',
    env_variable: 'BASE_URL',
    default_value: '',
    rules: ['nullable', 'string', 'max:200'],
  },
  {
    name: 'Git-Repo',
    description: 'Woher der Code geladen wird.',
    env_variable: 'GIT_ADDRESS',
    default_value: repo,
    rules: ['required', 'string', 'max:300'],
  },
  {
    name: 'Branch',
    description: 'Welcher Branch installiert wird.',
    env_variable: 'BRANCH',
    default_value: 'main',
    rules: ['required', 'string', 'max:100'],
  },
  {
    name: 'Git-Benutzername',
    description: 'Nur für ein privates Repo nötig.',
    env_variable: 'USERNAME',
    default_value: '',
    rules: ['nullable', 'string', 'max:100'],
  },
  {
    name: 'Git-Access-Token',
    description: 'Nur für ein privates Repo nötig (GitHub: Fine-grained Token mit Lesezugriff auf den Code).',
    env_variable: 'ACCESS_TOKEN',
    default_value: '',
    rules: ['nullable', 'string', 'max:300'],
  },
];

// JSON-Strings sind gültige YAML-Strings, damit sind Sonderzeichen sicher maskiert
const q = (value) => JSON.stringify(value);

const lines = [
  `_comment: ${q('Wichtel-Glücksrad – erzeugt mit npm run egg')}`,
  'meta:',
  '  version: PLCN_v3',
  '  update_url: null',
  `exported_at: ${q(new Date().toISOString())}`,
  `name: ${q('Wichtel-Glücksrad')}`,
  `author: ${q(author)}`,
  `uuid: ${UUID}`,
  `description: ${q(`${pkg.description}. Teilnehmer melden sich mit eigenem Passwort an und drehen am Rad, die Zuteilung steht vorher fest. Admin unter /admin, Befehle in der Konsole (help). Version ${pkg.version}.`)}`,
  'tags:',
  '  - nodejs',
  '  - web',
  'features: []',
  'docker_images:',
  `  ${q('Node.js 22')}: ghcr.io/pelican-eggs/yolks:nodejs_22`,
  `  ${q('Node.js 24')}: ghcr.io/pelican-eggs/yolks:nodejs_24`,
  'file_denylist: []',
  'startup_commands:',
  `  Default: ${q('node server/index.js')}`,
  'config:',
  '  files: {}',
  '  startup:',
  '    done:',
  `      - ${q('Konsole bereit')}`,
  '  logs: {}',
  '  stop: stop',
  'scripts:',
  '  installation:',
  '    script: |',
  ...installScript.trimEnd().split('\n').map((line) => (line ? `      ${line}` : '')),
  `    container: ${q('node:22-bookworm-slim')}`,
  '    entrypoint: bash',
  'variables:',
];

variables.forEach((v, index) => {
  lines.push(
    `  - sort: ${index + 1}`,
    `    name: ${q(v.name)}`,
    `    description: ${q(v.description)}`,
    `    env_variable: ${v.env_variable}`,
    `    default_value: ${q(v.default_value)}`,
    '    user_viewable: true',
    '    user_editable: true',
    '    rules:',
    ...v.rules.map((rule) => `      - ${q(rule)}`),
  );
});

const out = path.join(root, 'pelican', 'egg-wichtel-gluecksrad.yaml');
fs.writeFileSync(out, lines.join('\n') + '\n');
console.log(`Egg geschrieben: ${path.relative(root, out)}`);
