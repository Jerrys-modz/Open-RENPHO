import { weighInToMeasurements } from '../measurements';

describe('weighInToMeasurements', () => {
  it('stores weight, on-device body fat and impedance with one timestamp', () => {
    const out = weighInToMeasurements(
      { flavor: 'extended', weightKg: 74.95, bodyFat: 21, resistance1: 505, resistance2: 503 },
      123,
    );
    expect(out.map((m) => [m.type, m.value])).toEqual([
      ['weight', 74.95],
      ['body_fat', 21],
      ['impedance', 505],
    ]);
    expect(new Set(out.map((m) => m.takenAt))).toEqual(new Set([123]));
  });

  it('skips fields the scale did not provide', () => {
    const out = weighInToMeasurements(
      { flavor: 'basic', weightKg: 70, bodyFat: null, resistance1: null, resistance2: null },
      1,
    );
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('weight');
  });
});
