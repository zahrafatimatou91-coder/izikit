// Personalized dashboard greeting — time-of-day salutation + first name +
// a short rotating tagline, in the spirit of Claude/Gemini's landing
// greeting rather than a generic "Tableau de bord" page title.

/** First token of a full name — "Fatima Ahmat" -> "Fatima". Falls back to
 * the whole string if it's already a single word. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function isNightOwlHour(hour: number): boolean {
  return hour >= 23 || hour < 5;
}

/** "Bonjour" / "Bon après-midi" / "Bonsoir" / a night-owl greeting based on
 * the local hour — computed client-side so it reflects the viewer's own
 * clock, not the server's. 23h-4h59 gets its own phrase instead of being
 * lumped into "Bonsoir": nobody opening the app at 3am wants to be told
 * good evening — they want the app to notice. */
export function timeOfDayGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Bonjour';
  if (hour >= 12 && hour < 18) return 'Bon après-midi';
  if (hour >= 18 && hour < 23) return 'Bonsoir';
  return 'Encore debout à cette heure';
}

/** Companion emoji for the greeting above — a moon for the night-owl slot
 * (23h-4h59), a wave otherwise. */
export function timeOfDayEmoji(date: Date = new Date()): string {
  return isNightOwlHour(date.getHours()) ? '🌙' : '👋';
}

// Short, punchy, proverb-flavored — the kind of encouragement you'd hear
// from a grand frère qui te motive, never a guilt trip, never generic
// filler. Rotates once per day (stable within the day, varies day to day)
// rather than reshuffling on every render.
const TAGLINES = [
  'Petit à petit, l’oiseau fait son nid — et ton objectif aussi. 🐦',
  'Chaque brique posée aujourd’hui bâtit la maison de demain. 🧱',
  'Chaque franc économisé aujourd’hui est une victoire de demain. 🏆',
  'La patience paie toujours — continue, tu es sur la bonne voie. 🌱',
  'Debout ! Ton argent, tu le maîtrises aujourd’hui. 💪',
  'On ne lâche rien, franc après franc. 🔥',
  'Le succès se construit centime par centime. Continue comme ça ! ✨',
  'Qui sème aujourd’hui récolte demain. 🌾',
  'Ta discipline d’aujourd’hui, ta liberté de demain. 🚀',
  'Un pas à la fois, un franc à la fois. 👣',
  'Le travail bien fait ne trahit jamais. 💯',
  'Ce que tu économises aujourd’hui protège les tiens demain. 🏡',
];

// A gentler pool for the small hours — nobody needs a hustle pep talk at
// 3am. These check in instead of pushing.
const NIGHT_TAGLINES = [
  'La nuit porte conseil — pense aussi à te reposer. 🌙',
  'Tes comptes peuvent attendre le matin, ton sommeil non. 😴',
  'Une bonne nuit, c’est aussi un franc bien placé. Repose-toi. 🌙',
];

function dayOfYear(date: Date): number {
  return Math.floor(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
      Date.UTC(date.getFullYear(), 0, 0)) /
      86_400_000,
  );
}

export function dailyTagline(date: Date = new Date()): string {
  const pool = isNightOwlHour(date.getHours()) ? NIGHT_TAGLINES : TAGLINES;
  return pool[dayOfYear(date) % pool.length] as string;
}
