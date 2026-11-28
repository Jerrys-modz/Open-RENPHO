import type { Measurement } from '@/domain/measurement';
import { bloodPressureMetadataAttempts, measurementKey, pendingBloodPressure, pendingSamples, toHealthSample } from '../appleHealthMapping';

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

describe('blood pressure', () => {
  const bp = (type: Measurement['type'], value: number, takenAt = 5_000): Measurement => ({ type, value, takenAt, source: 'ihealth-kn550bt' });
  const list = [bp('bp_systolic', 125), bp('bp_diastolic', 64), bp('pulse', 69)];

  it('sends pulse as heart rate and leaves the pressures to the pair writer', () => {
    expect(toHealthSample(bp('pulse', 69))).toMatchObject({ identifier: 'HKQuantityTypeIdentifierHeartRate', unit: 'count/min', value: 69 });
    expect(toHealthSample(bp('bp_systolic', 125))).toBeNull();
  });

  it('pairs systolic and diastolic of the same reading', () => {
    const [s] = pendingBloodPressure(list, new Set());
    expect(s).toMatchObject({ systolic: 125, diastolic: 64, date: 5_000 });
    expect(pendingBloodPressure(list, new Set(s.keys))).toEqual([]);
  });

  it('skips a reading missing one half', () => {
    expect(pendingBloodPressure([bp('bp_systolic', 125)], new Set())).toEqual([]);
  });
});

describe('blood pressure arm and position for Apple Health', () => {
  const at = 5_000;
  const bp = (type: Measurement['type'], value: number, site?: string): Measurement => ({ type, value, takenAt: at, source: 'ihealth-kn550bt', site });

  it('carries the arm and position onto the sample', () => {
    const [s] = pendingBloodPressure([bp('bp_systolic', 125), bp('bp_diastolic', 64), bp('bp_arm', 1, 'right'), bp('bp_position', 1, 'standing')], new Set());
    expect(s).toMatchObject({ arm: 'right', position: 'standing' });
  });

  it('leaves them null when nothing was recorded', () => {
    const [s] = pendingBloodPressure([bp('bp_systolic', 125), bp('bp_diastolic', 64)], new Set());
    expect(s).toMatchObject({ arm: null, position: null });
    expect(bloodPressureMetadataAttempts(s)).toEqual([]);
  });

  it('tries Apple\'s placement side plus Keel keys first, then Keel keys alone', () => {
    expect(bloodPressureMetadataAttempts({ arm: 'left', position: 'sitting' })).toEqual([
      { KeelBloodPressureArm: 'left', KeelBodyPosition: 'sitting', HKDevicePlacementSide: 1 },
      { KeelBloodPressureArm: 'left', KeelBodyPosition: 'sitting' },
    ]);
    expect(bloodPressureMetadataAttempts({ arm: 'right', position: null })[0]).toMatchObject({ HKDevicePlacementSide: 2 });
  });

  it('sends only the position when there is no arm (no placement side to give)', () => {
    expect(bloodPressureMetadataAttempts({ arm: null, position: 'lying' })).toEqual([{ KeelBodyPosition: 'lying' }]);
  });
});
