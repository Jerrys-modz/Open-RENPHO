import { ageOn, type UserProfile } from '@/domain/profile';
import type { Measurement } from '@/domain/measurement';
import { calculateBodyFat, deriveBodyMetrics } from './bodyMetrics';
import { heightMeters, sexIndex } from './profile';
import type { WeighIn } from './session';

export const QN_SOURCE = 'qn-scale';
export const BEURER_SOURCE = 'beurer-bf720';

/**
 * Impedance used when the scale reports none. The open-source project this is ported from found
 * body fat changes by under 1 percentage point across 300-900 ohms, and that ~500 reproduces the
 * official RENPHO app's figures closely. The result is an estimate, not a measurement.
 */
export const SYNTHETIC_IMPEDANCE_OHMS = 500;

/**
 * Turns a finished weigh-in into stored measurements, all sharing one timestamp.
 *
 * The scale only gives weight and impedance (plus body fat when it was sent a profile). With a
 * profile we fill in body fat if the scale did not provide it, then derive the rest (BMI, water,
 * muscle, bone, protein, BMR) from it. Those derived values are approximations and can differ from
 * the RENPHO app's own numbers.
 */
export function weighInToMeasurements(w: WeighIn, takenAt: number, profile?: UserProfile | null): Measurement[] {
  const source = w.flavor === 'beurer' ? BEURER_SOURCE : QN_SOURCE;
  const add = (type: Measurement['type'], value: number): Measurement => ({
    type,
    value,
    takenAt,
    source,
  });
  const out: Measurement[] = [add('weight', w.weightKg)];

  let bodyFat = w.bodyFat !== null && w.bodyFat > 0 ? w.bodyFat : null;
  const r = w.resistance1 !== null && w.resistance1 > 0 ? w.resistance1 : null;
  // The broadcast-only scale sends no impedance. Estimate with a typical value; the algorithm is
  // nearly insensitive to it in the normal range (see SYNTHETIC_IMPEDANCE_OHMS).
  const rForCalc = r ?? (w.flavor === 'broadcast' ? SYNTHETIC_IMPEDANCE_OHMS : null);

  if (bodyFat === null && profile && rForCalc !== null) {
    try {
      bodyFat = calculateBodyFat({
        weightKg: w.weightKg,
        heightM: heightMeters(profile),
        age: ageOn(profile.birthDate, new Date(takenAt)),
        sex: sexIndex(profile),
        resistance: rForCalc,
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
    // Estimates from body fat; anything the scale measured itself replaces them.
    const metrics: Partial<Record<Measurement['type'], number>> = {};
    if (profile) {
      const d = deriveBodyMetrics(w.weightKg, heightMeters(profile), sexIndex(profile), bodyFat);
      Object.assign(metrics, {
        bmi: d.bmi,
        body_water: d.bodyWater,
        skeletal_muscle: d.skeletalMuscle,
        muscle_mass: d.muscleMass,
        fat_free_mass: d.fatFreeMass,
        bone_mass: d.boneMass,
        protein: d.protein,
        bmr: d.bmr,
      });
    }
    Object.assign(metrics, w.scaleMetrics);
    for (const [type, value] of Object.entries(metrics) as [Measurement['type'], number][]) {
      out.push(add(type, value));
    }
  }
  if (r !== null) out.push(add('impedance', r));
  return out;
}
