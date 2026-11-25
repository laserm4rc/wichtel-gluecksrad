// Zeitzonen-Helfer ohne zusätzliche Bibliothek.
// Pelican-Container laufen meist in UTC, Datum und Uhrzeit meint aber die Ortszeit (Standard: Europe/Berlin).

/** Abstand der Zeitzone zu UTC in Millisekunden zum Zeitpunkt `date`. */
function zoneOffset(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Ortszeit (Jahr, Monat, Tag, Stunde, Minute in `timeZone`) → Date. Berücksichtigt Sommer-/Winterzeit. */
export function zonedTimeToDate({ year, month, day, hour = 0, minute = 0 }, timeZone) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let result = guess - zoneOffset(new Date(guess), timeZone);
  const corrected = guess - zoneOffset(new Date(result), timeZone);
  if (corrected !== result) result = corrected;
  return new Date(result);
}

/**
 * Liest Datum und Uhrzeit aus der Konsole, z. B. "30.11.2026 18:00", "30.11. 18:00" oder "2026-11-30 18:00".
 * Ohne Uhrzeit gilt 00:00, ohne Jahr das aktuelle Jahr.
 */
export function parseLocalDateTime(input, timeZone, now = new Date()) {
  const text = String(input ?? '').trim();
  let parts;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/.exec(text);
  const german = /^(\d{1,2})\.(\d{1,2})\.(\d{4})?(?:,?\s+(\d{1,2}):(\d{2}))?(?:\s*Uhr)?$/i.exec(text);
  if (iso) {
    parts = { year: +iso[1], month: +iso[2], day: +iso[3], hour: +(iso[4] ?? 0), minute: +(iso[5] ?? 0) };
  } else if (german) {
    const year = german[3] ? +german[3] : now.getUTCFullYear();
    parts = { year, month: +german[2], day: +german[1], hour: +(german[4] ?? 0), minute: +(german[5] ?? 0) };
  } else {
    return null;
  }
  const { year, month, day, hour, minute } = parts;
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const date = zonedTimeToDate(parts, timeZone);
  // Ungültige Tage wie 31.11. abfangen
  const check = formatParts(date, timeZone);
  if (check.day !== day || check.month !== month) return null;
  return date;
}

function formatParts(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return { year: +parts.year, month: +parts.month, day: +parts.day };
}

/** z. B. "Sonntag, 30. November 2026 um 18:00 Uhr" */
export function formatDateTime(date, timeZone) {
  const day = new Intl.DateTimeFormat('de-DE', { timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  const time = new Intl.DateTimeFormat('de-DE', { timeZone, hour: '2-digit', minute: '2-digit' }).format(date);
  return `${day} um ${time} Uhr`;
}
