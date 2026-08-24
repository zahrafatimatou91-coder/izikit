// Swatch palette for user-customizable envelopes (and reused for avatar
// fallback colors). Class names are written out literally — Tailwind's
// scanner only picks up complete strings it finds in source, never ones
// built via string interpolation.
export const ENVELOPE_SWATCHES = [
  { key: 'envelope-1', bg: 'bg-envelope-1', text: 'text-secondary-foreground' }, // yellow — needs dark text
  { key: 'envelope-2', bg: 'bg-envelope-2', text: 'text-primary-foreground' },
  { key: 'envelope-3', bg: 'bg-envelope-3', text: 'text-primary-foreground' },
  { key: 'envelope-4', bg: 'bg-envelope-4', text: 'text-primary-foreground' },
  { key: 'envelope-5', bg: 'bg-envelope-5', text: 'text-primary-foreground' },
  { key: 'envelope-6', bg: 'bg-envelope-6', text: 'text-primary-foreground' },
  { key: 'envelope-7', bg: 'bg-envelope-7', text: 'text-primary-foreground' },
  { key: 'envelope-8', bg: 'bg-envelope-8', text: 'text-primary-foreground' },
] as const;

export type EnvelopeSwatchKey = (typeof ENVELOPE_SWATCHES)[number]['key'];

type EnvelopeSwatch = (typeof ENVELOPE_SWATCHES)[number];

// Keyed by plain `string` (not EnvelopeSwatchKey) — Prisma's `Envelope.color`
// column is an untyped string, so lookups take whatever the DB hands back.
const BY_KEY = new Map<string, EnvelopeSwatch>(ENVELOPE_SWATCHES.map((s) => [s.key, s]));

export function envelopeSwatch(key: string): EnvelopeSwatch {
  return BY_KEY.get(key) ?? ENVELOPE_SWATCHES[0];
}

const SWATCH_BG_CLASSES = ENVELOPE_SWATCHES.map((s) => s.bg);

/** Deterministic swatch key from an arbitrary string (e.g. a user's name),
 * so the same input always maps to the same color. */
export function swatchKeyFromString(input: string | null | undefined): EnvelopeSwatchKey {
  const str = input ?? '?';
  let hash = 0;
  for (let idx = 0; idx < str.length; idx++) {
    hash = (hash * 31 + str.charCodeAt(idx)) | 0;
  }
  return ENVELOPE_SWATCHES[Math.abs(hash) % ENVELOPE_SWATCHES.length]!.key;
}

export function swatchBgClassFromString(input: string | null | undefined): string {
  const str = input ?? '?';
  let hash = 0;
  for (let idx = 0; idx < str.length; idx++) {
    hash = (hash * 31 + str.charCodeAt(idx)) | 0;
  }
  return SWATCH_BG_CLASSES[Math.abs(hash) % SWATCH_BG_CLASSES.length]!;
}
