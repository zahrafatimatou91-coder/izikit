const MONTHS_FR = [
  'jan',
  'fév',
  'mar',
  'avr',
  'mai',
  'juin',
  'juil',
  'août',
  'sep',
  'oct',
  'nov',
  'déc',
];

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** "Aujourd'hui, 11h15" / "Hier, 20h05" / "31 oct, 14h30" — matches the
 * Banani design's transaction timestamp style. */
export function formatRelativeDateTime(date: Date, now: Date = new Date()): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const time = `${hh}h${mm}`;

  if (isSameDay(date, now)) return `Aujourd'hui, ${time}`;

  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (isSameDay(date, yesterday)) return `Hier, ${time}`;

  return `${date.getDate()} ${MONTHS_FR[date.getMonth()]}, ${time}`;
}
