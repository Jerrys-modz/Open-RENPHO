import { importedMeasurements, readingToMeasurements } from '../measurements';

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

describe('importedMeasurements', () => {
  const left = { arm: 'left' as const, position: 'sitting' as const };
  const second = { ...base, takenAt: 2_000 };

  it('applies the usual arm and position to readings it has not seen', () => {
    const out = importedMeasurements([], [base], left);
    expect(out.map((m) => [m.type, m.site])).toEqual(
      expect.arrayContaining([['bp_arm', 'left'], ['bp_position', 'sitting']]),
    );
  });

  it('does not re-apply the default to a reading already stored, so a correction in History survives', () => {
    const stored = [...readingToMeasurements(base, { arm: 'right', position: null, note: null })];
    const out = importedMeasurements(stored, [base, second], left);
    expect(out.filter((m) => m.takenAt === 1_000 && m.type === 'bp_arm')).toHaveLength(0);
    expect(out.filter((m) => m.takenAt === 2_000 && m.type === 'bp_arm').map((m) => m.site)).toEqual(['left']);
  });

  it('adds nothing extra when no defaults are set', () => {
    expect(importedMeasurements([], [base], { arm: null, position: null })).toHaveLength(3);
  });
});
