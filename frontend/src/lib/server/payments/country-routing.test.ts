import { describe, it, expect } from 'vitest';
import { resolveCountryRouting } from './country-routing';

describe('resolveCountryRouting', () => {
  it('routes UEMOA countries to Bictorys/XOF', () => {
    expect(resolveCountryRouting('SN')).toEqual({ provider: 'bictorys', currency: 'XOF' });
    expect(resolveCountryRouting('CI')).toEqual({ provider: 'bictorys', currency: 'XOF' });
    expect(resolveCountryRouting('ML')).toEqual({ provider: 'bictorys', currency: 'XOF' });
  });

  it('routes CEMAC countries to Moneroo/XAF', () => {
    expect(resolveCountryRouting('CM')).toEqual({ provider: 'moneroo', currency: 'XAF' });
    expect(resolveCountryRouting('GA')).toEqual({ provider: 'moneroo', currency: 'XAF' });
    expect(resolveCountryRouting('TD')).toEqual({ provider: 'moneroo', currency: 'XAF' });
  });

  it('is case-insensitive', () => {
    expect(resolveCountryRouting('sn')).toEqual({ provider: 'bictorys', currency: 'XOF' });
    expect(resolveCountryRouting('cm')).toEqual({ provider: 'moneroo', currency: 'XAF' });
  });

  it('defaults to Bictorys/XOF for null (accounts created before the field existed)', () => {
    expect(resolveCountryRouting(null)).toEqual({ provider: 'bictorys', currency: 'XOF' });
    expect(resolveCountryRouting(undefined)).toEqual({ provider: 'bictorys', currency: 'XOF' });
  });

  it('defaults to Bictorys/XOF for an unrecognized country', () => {
    expect(resolveCountryRouting('US')).toEqual({ provider: 'bictorys', currency: 'XOF' });
  });

  it('defaults to Bictorys/XOF for an empty string', () => {
    expect(resolveCountryRouting('')).toEqual({ provider: 'bictorys', currency: 'XOF' });
  });
});
