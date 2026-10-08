import { ageOn, type UserProfile } from '@/domain/profile';
import type { Measurement } from '@/domain/measurement';
import { calculateBodyFat, deriveBodyMetrics } from './bodyMetrics';
import { heightMeters, sexIndex } from './profile';
import type { WeighIn } from './session';

export const QN_SOURCE = 'qn-scale';

/**
 * Turns a finished weigh-in into stored measurements, all sharing one timestamp.
 *
 * The scale only gives weight and impedance (plus body fat when it was sent a profile). With a
 * profile we fill in body fat if the scale did not provide it, then derive the rest (BMI, water,
 * muscle, bone, protein, BMR) from it. Those derived values are approximations and can differ from
 * the RENPHO app's own numbers.
 */
export function weighInToMeasurements(w: WeighIn, takenAt: number, profile?: UserProfile | null): Measurement[] {
  const add = (type: Measurement['type'], value: number): Measurement => ({
    type,
    value,
    takenAt,
    source: QN_SOURCE,
  });
  const out: Measurement[] = [add('weight', w.weightKg)];

  let bodyFat = w.bodyFat !== null && w.bodyFat > 0 ? w.bodyFat : null;
  const r = w.resistance1 !== null && w.resistance1 > 0 ? w.resistance1 : null;

  if (bodyFat === null && profile && r !== null) {
    try {
      bodyFat = calculateBodyFat({
        weightKg: w.weightKg,
        heightM: heightMeters(profile),
        age: ageOn(profile.birthDate, new Date(takenAt)),
        sex: sexIndex(profile),
        resistance: r,
        athlete: profile.athlete,
      });
    } catch {
      bodyFat = null;
    }
  }
  // Anything outside this range is a bad reading, not a body.
  if (bodyFat !== null && (bodyFat < 2 || bodyFat > 70)) bodyFat = null;

  if (bodyFat !== null) {
    out.push(add('body_fat', bodyFat));
    if (profile) {
      const d = deriveBodyMetrics(w.weightKg, heightMeters(profile), sexIndex(profile), bodyFat);
      out.push(
        add('bmi', d.bmi),
        add('body_water', d.bodyWater),
        add('skeletal_muscle', d.skeletalMuscle),
        add('muscle_mass', d.muscleMass),
        add('fat_free_mass', d.fatFreeMass),
        add('bone_mass', d.boneMass),
        add('protein', d.protein),
        add('bmr', d.bmr),
      );
    }
  }
  if (r !== null) out.push(add('impedance', r));
  return out;
}
