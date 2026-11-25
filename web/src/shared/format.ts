/** Zeitstempel aus SQLite ("YYYY-MM-DD HH:MM:SS", UTC) in deutscher Ortszeit, z. B. "25.11., 19:42". */
export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(`${value.replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** z. B. "Montag, 30. November 2026 um 18:00 Uhr" in der Zeitzone des Events. */
export function formatDateTimeLong(iso: string, timeZone?: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('de-DE', { timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const time = date.toLocaleTimeString('de-DE', { timeZone, hour: '2-digit', minute: '2-digit' });
  return `${day} um ${time} Uhr`;
}

/** Restzeit als Text, z. B. "4 Tage und 3 Stunden", "2 Stunden und 15 Minuten", "weniger als einer Minute". */
export function formatCountdown(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const unit = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (days > 0) return hours > 0 ? `${unit(days, 'Tag', 'Tagen')} und ${unit(hours, 'Stunde', 'Stunden')}` : unit(days, 'Tag', 'Tagen');
  if (hours > 0) return mins > 0 ? `${unit(hours, 'Stunde', 'Stunden')} und ${unit(mins, 'Minute', 'Minuten')}` : unit(hours, 'Stunde', 'Stunden');
  if (mins > 0) return unit(mins, 'Minute', 'Minuten');
  return 'weniger als einer Minute';
}
