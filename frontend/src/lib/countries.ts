// Client-safe country list for the onboarding "quel est ton pays" step.
// No `server-only` import — this is rendered directly in a client component.
//
// The server-side routing decision (country -> provider/currency) lives in
// lib/server/payments/country-routing.ts and derives its UEMOA/CEMAC sets
// from this same list, so the two can never drift apart.
export type PaymentZone = 'UEMOA' | 'CEMAC';

export interface CountryOption {
  code: string; // ISO 3166-1 alpha-2
  name: string;
}

export interface CountryGroup {
  zone: PaymentZone;
  currency: 'XOF' | 'XAF';
  countries: CountryOption[];
}

export const COUNTRY_GROUPS: CountryGroup[] = [
  {
    zone: 'UEMOA',
    currency: 'XOF',
    countries: [
      { code: 'SN', name: 'Sénégal' },
      { code: 'CI', name: "Côte d'Ivoire" },
      { code: 'ML', name: 'Mali' },
      { code: 'BF', name: 'Burkina Faso' },
      { code: 'BJ', name: 'Bénin' },
      { code: 'TG', name: 'Togo' },
      { code: 'NE', name: 'Niger' },
      { code: 'GW', name: 'Guinée-Bissau' },
    ],
  },
  {
    zone: 'CEMAC',
    currency: 'XAF',
    countries: [
      { code: 'CM', name: 'Cameroun' },
      { code: 'GA', name: 'Gabon' },
      { code: 'CG', name: 'Congo' },
      { code: 'TD', name: 'Tchad' },
      { code: 'CF', name: 'République centrafricaine' },
      { code: 'GQ', name: 'Guinée équatoriale' },
    ],
  },
];

/** Flat lookup, e.g. for rendering a selected country's display name. */
export const ALL_COUNTRIES: CountryOption[] = COUNTRY_GROUPS.flatMap((g) => g.countries);
