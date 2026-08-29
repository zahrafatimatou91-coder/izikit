// Personalized dashboard greeting — time-of-day salutation + first name +
// a short rotating tagline, in the spirit of Claude/Gemini's landing
// greeting rather than a generic "Tableau de bord" page title.

/** First token of a full name — "Fatima Ahmat" -> "Fatima". Falls back to
 * the whole string if it's already a single word. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** "Bonjour" / "Bon après-midi" / "Bonsoir" based on the local hour —
 * computed client-side so it reflects the viewer's own clock, not the
 * server's. */
export function timeOfDayGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Bonjour';
  if (hour >= 12 && hour < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

// Short, punchy, budgeting-flavored — never a guilt trip, never generic
// filler. Rotates once per day (stable within the day, varies day to
// day) rather than reshuffling on every render.
const TAGLINES = [
  'Chaque franc compte. 💪',
  "Aujourd'hui est un bon jour pour économiser.",
  'Petit à petit, ton objectif se rapproche. 🎯',
  'Ton argent, tes règles.',
  'Reste dans le vert aujourd’hui.',
  'Un franc économisé est un franc gagné.',
  'Continue sur ta lancée !',
  'Fais de chaque dépense un choix, pas un réflexe.',
  'Ta discipline d’aujourd’hui, ta tranquillité de demain.',
  'Petites économies, grands résultats.',
];

export function dailyTagline(date: Date = new Date()): string {
  const dayOfYear = Math.floor(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
      Date.UTC(date.getFullYear(), 0, 0)) /
      86_400_000,
  );
  return TAGLINES[dayOfYear % TAGLINES.length] as string;
}
