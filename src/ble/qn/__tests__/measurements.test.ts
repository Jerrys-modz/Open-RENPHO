import type { UserProfile } from '@/domain/profile';
import { weighInToMeasurements } from '../measurements';

const PROFILE: UserProfile = { sex: 'male', birthDate: '1983-01-01', heightCm: 170, athlete: false };
const types = (ms: { type: string }[]) => ms.map((m) => m.type);
const get = (ms: { type: string; value: number }[], t: string) => ms.find((m) => m.type === t)?.value;

describe('weighInToMeasurements', () => {
  it('without a profile stores only weight, any on-device body fat, and impedance', () => {
    const out = weighInToMeasurements(
      { flavor: 'extended', weightKg: 74.95, bodyFat: 21, resistance1: 505, resistance2: 503 },
      123,
    );
    expect(types(out)).toEqual(['weight', 'body_fat', 'impedance']);
    expect(new Set(out.map((m) => m.takenAt))).toEqual(new Set([123]));
  });

  it('skips fields the scale did not provide', () => {
    const out = weighInToMeasurements(
      { flavor: 'basic', weightKg: 70, bodyFat: null, resistance1: null, resistance2: null },
      1,
    );
    expect(types(out)).toEqual(['weight']);
  });

  it('with a profile derives BMI, water, muscle, bone, protein and BMR from the on-device body fat', () => {
    const out = weighInToMeasurements(
      { flavor: 'extended', weightKg: 74.95, bodyFat: 21, resistance1: 505, resistance2: 503 },
      Date.UTC(2026, 9, 7),
      PROFILE,
    );
    expect(types(out)).toEqual([
      'weight',
      'body_fat',
      'bmi',
      'body_water',
      'skeletal_muscle',
      'muscle_mass',
      'fat_free_mass',
      'bone_mass',
      'protein',
      'bmr',
      'impedance',
    ]);
    expect(get(out, 'body_fat')).toBe(21);
    expect(get(out, 'bmi')).toBeCloseTo(25.9, 1); // 74.95 / 1.70^2
    expect(get(out, 'fat_free_mass')).toBeCloseTo(59.21, 1);
  });

  it('on a basic-flavor scale computes body fat from impedance (matches the captured golden: M 43y, 1.70 m, 74.95 kg, 505 ohm -> 21.0)', () => {
    const out = weighInToMeasurements(
      { flavor: 'basic', weightKg: 74.95, bodyFat: null, resistance1: 505, resistance2: 503 },
      Date.UTC(2026, 9, 7),
      PROFILE,
    );
    expect(get(out, 'body_fat')).toBeCloseTo(21.0, 1);
    expect(get(out, 'bmi')).toBeDefined();
  });

  it('drops an implausible body fat instead of storing it', () => {
    const out = weighInToMeasurements(
      { flavor: 'extended', weightKg: 70, bodyFat: 95, resistance1: 500, resistance2: 500 },
      1,
      PROFILE,
    );
    expect(types(out)).toEqual(['weight', 'impedance']);
  });
});
