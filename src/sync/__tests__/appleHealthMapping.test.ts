import type { Measurement } from '@/domain/measurement';
import { measurementKey, pendingSamples, toHealthSample } from '../appleHealthMapping';

const m = (type: Measurement['type'], value: number, extra: Partial<Measurement> = {}): Measurement => ({
  type,
  value,
  takenAt: 1_000,
  source: 't',
  ...extra,
});

describe('toHealthSample', () => {
  it('maps weight, lean mass and BMI as-is', () => {
    expect(toHealthSample(m('weight', 107.5))).toMatchObject({ identifier: 'HKQuantityTypeIdentifierBodyMass', unit: 'kg', value: 107.5 });
    expect(toHealthSample(m('fat_free_mass', 85.4))).toMatchObject({ identifier: 'HKQuantityTypeIdentifierLeanBodyMass', unit: 'kg' });
    expect(toHealthSample(m('bmi', 34.3))).toMatchObject({ identifier: 'HKQuantityTypeIdentifierBodyMassIndex', unit: 'count', value: 34.3 });
  });

  it('sends body fat as a fraction', () => {
    expect(toHealthSample(m('body_fat', 20.6))?.value).toBeCloseTo(0.206, 6);
  });

  it('sends only the waist to Apple Health, in metres', () => {
    expect(toHealthSample(m('circumference', 101.5, { site: 'waist' }))).toMatchObject({
      identifier: 'HKQuantityTypeIdentifierWaistCircumference',
      unit: 'm',
      value: 1.015,
    });
    expect(toHealthSample(m('circumference', 40, { site: 'bicep' }))).toBeNull();
  });

  it('skips metrics Apple Health has no type for', () => {
    for (const t of ['body_water', 'muscle_mass', 'bone_mass', 'protein', 'bmr', 'impedance', 'skeletal_muscle'] as const) {
      expect(toHealthSample(m(t, 1))).toBeNull();
    }
  });
});

describe('pendingSamples', () => {
  const list = [m('weight', 100), m('body_fat', 20), m('bone_mass', 4), m('circumference', 100, { site: 'waist' })];

  it('returns only mappable readings that are not yet synced', () => {
    expect(pendingSamples(list, new Set()).map((s) => s.identifier)).toEqual([
      'HKQuantityTypeIdentifierBodyMass',
      'HKQuantityTypeIdentifierBodyFatPercentage',
      'HKQuantityTypeIdentifierWaistCircumference',
    ]);
    expect(pendingSamples(list, new Set([measurementKey(list[0])])).map((s) => s.identifier)).not.toContain(
      'HKQuantityTypeIdentifierBodyMass',
    );
  });

  it('keeps waist and hips taken at the same time distinct', () => {
    expect(measurementKey(m('circumference', 1, { site: 'waist' }))).not.toBe(measurementKey(m('circumference', 1, { site: 'hips' })));
  });
});
