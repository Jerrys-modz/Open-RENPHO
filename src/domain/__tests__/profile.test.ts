import { ageOn, parseProfile, serializeProfile, validateProfile } from '../profile';

const NOW = new Date(2026, 9, 8); // 8 Oct 2026, local time

describe('ageOn', () => {
  it('is birthday-aware', () => {
    expect(ageOn('1983-10-08', NOW)).toBe(43);
    expect(ageOn('1983-10-09', NOW)).toBe(42);
    expect(ageOn('1983-01-01', NOW)).toBe(43);
  });
});

describe('validateProfile', () => {
  const ok = { sex: 'female' as const, birthDate: '1990-04-23', heightCm: '165', athlete: false };

  it('accepts a good profile and converts the height', () => {
    const r = validateProfile(ok, NOW);
    expect(r).toEqual({ ok: true, profile: { sex: 'female', birthDate: '1990-04-23', heightCm: 165, athlete: false } });
  });
  it('accepts a decimal comma in the height', () => {
    const r = validateProfile({ ...ok, heightCm: '170,5' }, NOW);
    expect(r.ok && r.profile.heightCm).toBe(170.5);
  });
  it('rejects bad dates and impossible dates', () => {
    expect(validateProfile({ ...ok, birthDate: '23/04/1990' }, NOW).ok).toBe(false);
    expect(validateProfile({ ...ok, birthDate: '1990-02-31' }, NOW).ok).toBe(false);
  });
  it('rejects ages and heights outside a sensible range', () => {
    expect(validateProfile({ ...ok, birthDate: '2025-01-01' }, NOW).ok).toBe(false);
    expect(validateProfile({ ...ok, heightCm: '50' }, NOW).ok).toBe(false);
    expect(validateProfile({ ...ok, heightCm: 'tall' }, NOW).ok).toBe(false);
  });
  it('reports every problem at once', () => {
    const r = validateProfile({ ...ok, birthDate: 'x', heightCm: '1' }, NOW);
    expect(!r.ok && r.errors).toHaveLength(2);
  });
});

describe('serializeProfile / parseProfile', () => {
  it('round-trips', () => {
    const p = { sex: 'male' as const, birthDate: '1983-01-01', heightCm: 170, athlete: true };
    expect(parseProfile(serializeProfile(p))).toEqual(p);
  });
  it('returns null for garbage', () => {
    expect(parseProfile('nope')).toBeNull();
    expect(parseProfile('{"profile":{"sex":"x"}}')).toBeNull();
  });
});
