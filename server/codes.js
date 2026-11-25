import crypto from 'node:crypto';

// Gut lesbare Wörter ohne Umlaute, damit sich die Passwörter am Handy leicht tippen lassen.
const WORDS = [
  'apfel', 'baum', 'birne', 'engel', 'fichte', 'flocke', 'gans', 'geschenk', 'glanz', 'glocke',
  'kakao', 'kamin', 'kerze', 'kekse', 'kranz', 'krippe', 'kugel', 'lametta', 'laterne', 'lebkuchen',
  'licht', 'mandel', 'mantel', 'marzipan', 'mistel', 'mond', 'muetze', 'nuss', 'orange', 'paket',
  'plaetzchen', 'punsch', 'rentier', 'rodel', 'schal', 'schlitten', 'schnee', 'socke', 'stern', 'stollen',
  'tanne', 'teller', 'winter', 'wolle', 'zimt', 'zucker', 'zweig', 'eiszapfen', 'feuer', 'fuchs',
  'hirsch', 'igel', 'kristall', 'pinguin', 'eule', 'moos', 'rabe', 'eisbaer', 'holz', 'honig',
  'vanille', 'nelke', 'anis', 'beere',
];

/** Erzeugt ein Passwort wie "tanne-zimt-472". */
export function generatePassword() {
  const pick = () => WORDS[crypto.randomInt(WORDS.length)];
  let second = pick();
  const first = pick();
  while (second === first) second = pick();
  const number = String(crypto.randomInt(100, 1000));
  return `${first}-${second}-${number}`;
}

/** Längeres Passwort für den Co-Admin, z. B. "tanne-zimt-kerze-47". */
export function generateAdminPassword() {
  const pick = () => WORDS[crypto.randomInt(WORDS.length)];
  return `${pick()}-${pick()}-${pick()}-${crypto.randomInt(10, 100)}`;
}

/**
 * Vereinheitlicht eine Eingabe für den Vergleich.
 * Passwörter haben immer Bindestriche, nie Leerzeichen: "tanne zimt 472" passt also NICHT.
 * Nur Groß-/Kleinschreibung und Leerzeichen am Anfang/Ende werden ignoriert,
 * weil Handys den ersten Buchstaben gern groß schreiben.
 */
export function normalizePassword(input) {
  return String(input ?? '').trim().toLowerCase();
}

/** Erlaubtes Format für selbst vergebene Passwörter: Wörter oder Zahlen, getrennt durch Bindestriche. */
export const PASSWORD_PATTERN = /^[a-z0-9äöüß]+(-[a-z0-9äöüß]+)*$/;
