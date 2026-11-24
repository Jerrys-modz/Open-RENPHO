import { readingToMeasurements } from '../measurements';

const base = { takenAt: 1_000, systolic: 125, diastolic: 64, pulse: 69, irregularPulse: false, bodyMovement: false };

describe('readingToMeasurements', () => {
  it('stores the three values for an ordinary reading', () => {
    expect(readingToMeasurements(base).map((m) => [m.type, m.value])).toEqual([
      ['bp_systolic', 125],
      ['bp_diastolic', 64],
      ['pulse', 69],
    ]);
  });

  it('adds a flag row only when the cuff set the flag', () => {
    const flagged = readingToMeasurements({ ...base, irregularPulse: true, bodyMovement: true });
    expect(flagged.map((m) => m.type)).toEqual(['bp_systolic', 'bp_diastolic', 'pulse', 'irregular_pulse', 'body_movement']);
    expect(new Set(flagged.map((m) => m.takenAt)).size).toBe(1);
  });
});
