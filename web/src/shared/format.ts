/** Zeitstempel aus SQLite ("YYYY-MM-DD HH:MM:SS", UTC) in deutscher Ortszeit, z. B. "25.11., 19:42". */
export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(`${value.replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
