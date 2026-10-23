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
    const metrics = derivedMetrics(w.weightKg, bodyFat, profile);
    Object.assign(metrics, w.scaleMetrics);
    for (const [type, value] of Object.entries(metrics) as [Measurement['type'], number][]) {
      out.push(add(type, value));
    }
  }
  if (r !== null) out.push(add('impedance', r));
  return out;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

type Metrics = Partial<Record<Measurement['type'], number>>;

/**
 * Everything we can work out from weight and body fat. Body fat mass needs nothing else; the rest
 * need the profile (sex and height).
 */
export function derivedMetrics(weightKg: number, bodyFat: number, profile?: UserProfile | null): Metrics {
  const kg = (pct: number) => Math.round(((weightKg * pct) / 100) * 100) / 100;
  const out: Metrics = { fat_mass: kg(bodyFat) };
  if (!profile) return out;
  let d;
  try {
    d = deriveBodyMetrics(weightKg, heightMeters(profile), sexIndex(profile), bodyFat);
  } catch {
    return out;
  }
  return {
    ...out,
    muscle_percent: round1((d.muscleMass / weightKg) * 100),
    skeletal_muscle_mass: kg(d.skeletalMuscle),
    bone_percent: round1((d.boneMass / weightKg) * 100),
    body_water_mass: kg(d.bodyWater),
    protein_mass: kg(d.protein),
    bmi: d.bmi,
    body_water: d.bodyWater,
    skeletal_muscle: d.skeletalMuscle,
    muscle_mass: d.muscleMass,
    fat_free_mass: d.fatFreeMass,
    bone_mass: d.boneMass,
    protein: d.protein,
    bmr: d.bmr,
  };
}

/**
 * Fills in stats that weigh-ins saved before they existed are missing (e.g. body fat mass), from the
 * weight and body fat already stored. Never overwrites a stored value. Returns the same array when
 * there is nothing to add.
 */
export function backfillDerived(list: readonly Measurement[], profile?: UserProfile | null): readonly Measurement[] {
  const have = new Set<string>();
  const entries = new Map<string, { weight?: number; bodyFat?: number; source: string; takenAt: number }>();
  for (const m of list) {
    if (m.type === 'circumference') continue;
    const id = `${m.source}|${m.takenAt}`;
    have.add(`${id}|${m.type}`);
    const e = entries.get(id) ?? { source: m.source, takenAt: m.takenAt };
    if (m.type === 'weight') e.weight = m.value;
    if (m.type === 'body_fat') e.bodyFat = m.value;
    entries.set(id, e);
  }
  const add: Measurement[] = [];
  for (const [id, e] of entries) {
    if (e.weight === undefined || e.bodyFat === undefined) continue;
    const derived = derivedMetrics(e.weight, e.bodyFat, profile);
    for (const [type, value] of Object.entries(derived) as [Measurement['type'], number][]) {
      if (!have.has(`${id}|${type}`)) add.push({ type, value, takenAt: e.takenAt, source: e.source });
    }
  }
  return add.length === 0 ? list : [...list, ...add];
}
