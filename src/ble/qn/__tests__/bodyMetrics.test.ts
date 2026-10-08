import { calculateBodyFat, deriveBodyMetrics, type SexIndex } from '../bodyMetrics';

// Golden vectors from real stable-with-metrics frames captured from live ES-CS20M
// scales (renpho-escs20m tests/test_calculate_body_fat.py). Expected body fat is
// exactly what the scale broadcast.
// [label, sex, age, heightM, algorithm, athlete, weightKg, r1, expected]
const GOLDENS: [string, SexIndex, number, number, number, boolean, number, number, number][] = [
  ['M-04-N-1', 0, 43, 1.7, 0x04, false, 74.95, 505, 21.0],
  ['M-04-N-4', 0, 43, 1.7, 0x04, false, 81.3, 505, 24.3],
  ['M-04-Y-1', 0, 43, 1.7, 0x04, true, 75.35, 498, 14.7],
  ['M-03-N-1', 0, 43, 1.7, 0x03, false, 81.75, 502, 29.7],
  ['M-03-Y-1', 0, 43, 1.7, 0x03, true, 81.75, 510, 17.9],
  ['F38-04-Y-1', 1, 38, 1.55, 0x04, true, 81.65, 510, 28.3],
  ['F38-03-Y-1', 1, 38, 1.55, 0x03, true, 81.65, 509, 27.9],
  ['F38-04-N-1', 1, 38, 1.55, 0x04, false, 81.65, 510, 42.5],
  ['F38-03-N-1', 1, 38, 1.55, 0x03, false, 81.65, 507, 41.2],
  ['F28-04-Y-1', 1, 28, 1.85, 0x04, true, 81.65, 499, 18.6],
  ['F28-03-Y-1', 1, 28, 1.85, 0x03, true, 81.65, 496, 19.6],
  ['F28-04-N-1', 1, 28, 1.85, 0x04, false, 81.65, 503, 25.9],
  ['F28-03-N-1', 1, 28, 1.85, 0x03, false, 81.65, 510, 29.1],
];

describe('calculateBodyFat', () => {
  it.each(GOLDENS)('matches the scale firmware: %s', (_l, sex, age, h, algorithm, athlete, w, r, expected) => {
    expect(
      calculateBodyFat({ weightKg: w, heightM: h, age, sex, resistance: r, algorithm, athlete }),
    ).toBeCloseTo(expected, 1);
  });

  it('rejects unsupported algorithms and non-positive inputs', () => {
    const base = { weightKg: 70, heightM: 1.7, age: 30, sex: 0 as SexIndex, resistance: 500 };
    expect(() => calculateBodyFat({ ...base, algorithm: 0x09 })).toThrow(RangeError);
    expect(() => calculateBodyFat({ ...base, resistance: 0 })).toThrow(RangeError);
    expect(() => calculateBodyFat({ ...base, weightKg: 0 })).toThrow(RangeError);
  });
});

describe('deriveBodyMetrics', () => {
  it('produces self-consistent, in-range values', () => {
    const m = deriveBodyMetrics(75, 1.75, 0, 20);
    expect(m.bmi).toBe(24.5);
    expect(m.fatFreeMass).toBe(60);
    expect(m.boneMass).toBeGreaterThanOrEqual(1);
    expect(m.boneMass).toBeLessThanOrEqual(7);
    // fat + bone + muscle accounts for the whole body
    expect(m.muscleMass + m.boneMass + 75 * 0.2).toBeCloseTo(75, 1);
    expect(m.bmr).toBeGreaterThanOrEqual(900);
  });
});
