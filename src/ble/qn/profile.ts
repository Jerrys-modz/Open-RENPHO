import { ageOn, type UserProfile } from '@/domain/profile';
import { DEFAULT_ALGORITHM, type ScaleProfile } from './protocol';
import type { SexIndex } from './bodyMetrics';

export const sexIndex = (p: UserProfile): SexIndex => (p.sex === 'female' ? 1 : 0);

/** The RENPHO app truncates height to whole cm; do the same so values match it more closely. */
export const heightMeters = (p: UserProfile): number => Math.trunc(p.heightCm) / 100;

/** What the extended-flavor scale needs to compute body fat on-device. */
export function toScaleProfile(p: UserProfile, now: Date = new Date()): ScaleProfile {
  return {
    sex: sexIndex(p),
    age: ageOn(p.birthDate, now),
    heightM: heightMeters(p),
    athlete: p.athlete,
    algorithm: DEFAULT_ALGORITHM,
  };
}
