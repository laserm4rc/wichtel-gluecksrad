import crypto from 'node:crypto';

/**
 * Berechnet eine vollständige Wichtel-Zuteilung.
 *
 * - Niemand zieht sich selbst.
 * - Ausschlüsse gelten in beide Richtungen (z. B. Paare).
 * - Jede Person wird genau einmal gezogen.
 *
 * Zuerst wird zufällig gewürfelt und verworfen, bis eine gültige Zuteilung
 * entsteht. Das ergibt eine gleichverteilte Auswahl unter allen gültigen
 * Zuteilungen. Klappt das nach vielen Versuchen nicht (viele Ausschlüsse),
 * sucht eine Backtracking-Suche gezielt nach einer Lösung oder stellt fest,
 * dass es keine gibt.
 *
 * @param {number[]} ids        Teilnehmer-IDs
 * @param {Array<[number, number]>} exclusions  Paare, die sich nicht ziehen dürfen
 * @returns {Map<number, number>} Schenkender -> Beschenkter
 * @throws wenn keine gültige Zuteilung existiert
 */
export function computeAssignment(ids, exclusions = []) {
  if (ids.length < 2) {
    throw new DrawError('Für eine Ziehung braucht es mindestens 2 Teilnehmer.');
  }

  const blocked = new Set();
  for (const [a, b] of exclusions) {
    blocked.add(`${a}:${b}`);
    blocked.add(`${b}:${a}`);
  }
  const allowed = (giver, receiver) => giver !== receiver && !blocked.has(`${giver}:${receiver}`);

  // 1) Zufällig würfeln und verwerfen
  for (let attempt = 0; attempt < 5000; attempt++) {
    const receivers = shuffle([...ids]);
    if (ids.every((giver, i) => allowed(giver, receivers[i]))) {
      return new Map(ids.map((giver, i) => [giver, receivers[i]]));
    }
  }

  // 2) Backtracking: Schenkende mit den wenigsten Möglichkeiten zuerst
  const options = new Map(ids.map((g) => [g, shuffle(ids.filter((r) => allowed(g, r)))]));
  const givers = [...ids].sort((a, b) => options.get(a).length - options.get(b).length);
  const result = new Map();
  const taken = new Set();

  const solve = (index) => {
    if (index === givers.length) return true;
    const giver = givers[index];
    for (const receiver of options.get(giver)) {
      if (taken.has(receiver)) continue;
      taken.add(receiver);
      result.set(giver, receiver);
      if (solve(index + 1)) return true;
      taken.delete(receiver);
      result.delete(giver);
    }
    return false;
  };

  if (!solve(0)) {
    throw new DrawError('Mit diesen Ausschlüssen ist keine gültige Zuteilung möglich.');
  }
  return result;
}

export class DrawError extends Error {}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
