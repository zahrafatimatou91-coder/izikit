/**
 * Country → payment-provider routing.
 *
 * Neither Bictorys nor Moneroo covers all of Francophone Africa alone:
 *   - Bictorys is UEMOA-only (8 countries, XOF).
 *   - Moneroo is the CEMAC-capable complement (6 countries, XAF) plus the
 *     rest of the African Mobile Money market.
 *
 * `User.country` (ISO 3166-1 alpha-2, set during onboarding) decides which
 * provider + currency a checkout uses — never a client-supplied value, so a
 * request can't pick its own provider/currency pairing.
 *
 * `null`/unknown country defaults to UEMOA/Bictorys/XOF — this app's
 * original single-market behavior, preserved for every account created
 * before this field existed and for any country outside both zones (no
 * provider covers it yet; routing to the historical default beats a hard
 * failure at checkout).
 *
 * The UEMOA/CEMAC membership itself is derived from `COUNTRY_GROUPS` in
 * lib/countries.ts (the client-safe list backing the onboarding country
 * picker) rather than duplicated here, so the two can never drift apart.
 */
import 'server-only';
import { COUNTRY_GROUPS } from '@/lib/countries';

export type PaymentProviderName = 'bictorys' | 'moneroo';
export type PaymentCurrency = 'XOF' | 'XAF';

export interface CountryRouting {
  provider: PaymentProviderName;
  currency: PaymentCurrency;
}

const PROVIDER_BY_ZONE: Record<(typeof COUNTRY_GROUPS)[number]['zone'], PaymentProviderName> = {
  UEMOA: 'bictorys',
  CEMAC: 'moneroo',
};

const ROUTING_BY_COUNTRY = new Map<string, CountryRouting>(
  COUNTRY_GROUPS.flatMap((group) =>
    group.countries.map(
      (c) =>
        [c.code, { provider: PROVIDER_BY_ZONE[group.zone], currency: group.currency }] as const,
    ),
  ),
);

const DEFAULT_ROUTING: CountryRouting = { provider: 'bictorys', currency: 'XOF' };

/**
 * Resolve which provider + currency a checkout should use for a given
 * `User.country`. Case-insensitive; `null`/unrecognized falls back to
 * `DEFAULT_ROUTING` (see module doc for why).
 */
export function resolveCountryRouting(country: string | null | undefined): CountryRouting {
  if (!country) return DEFAULT_ROUTING;
  const code = country.trim().toUpperCase();
  return ROUTING_BY_COUNTRY.get(code) ?? DEFAULT_ROUTING;
}
