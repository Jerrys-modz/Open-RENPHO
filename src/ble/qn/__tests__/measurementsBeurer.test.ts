import type { UserProfile } from '@/domain/profile';
import { BEURER_SOURCE, weighInToMeasurements } from '../measurements';
import type { WeighIn } from '../session';

const profile: UserProfile = { sex: 'male', birthDate: '1985-04-02', heightCm: 170, athlete: false };

const weighIn: WeighIn = {
  flavor: 'beurer',
  weightKg: 90.82,
  bodyFat: 42.2,
  resistance1: 437,
  resistance2: null,
  scaleMetrics: { bmr: 1620, bmi: 31.4, muscle_mass: 27.6 },
};

describe('weighInToMeasurements for a Beurer scale', () => {
  const ms = weighInToMeasurements(weighIn, 1000, profile);
  const get = (t: string) => ms.find((m) => m.type === t)?.value;

  it('tags the source and keeps real impedance', () => {
    expect(ms.every((m) => m.source === BEURER_SOURCE)).toBe(true);
    expect(get('impedance')).toBe(437);
    expect(get('body_fat')).toBe(42.2);
  });

  it('lets scale-measured metrics win over estimates', () => {
    expect(get('bmr')).toBe(1620);
    expect(get('bmi')).toBe(31.4);
    expect(get('muscle_mass')).toBe(27.6);
  });

  it('fills the rest from body fat when a profile exists', () => {
    expect(get('bone_mass')).toBeDefined();
    expect(get('protein')).toBeDefined();
  });

  it('stores only what the scale sent when there is no profile', () => {
    const bare = weighInToMeasurements(weighIn, 1000, null);
    expect(bare.map((m) => m.type).sort()).toEqual(['bmi', 'bmr', 'body_fat', 'impedance', 'muscle_mass', 'weight']);
  });
});
