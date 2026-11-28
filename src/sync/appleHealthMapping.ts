import { bpContextOf, type BpContext } from '@/domain/bloodPressure';
import type { Measurement } from '@/domain/measurement';

/** The HealthKit sample types we write. Everything else (water, bone, BMR...) has no Apple Health home. */
export type HealthIdentifier =
  | 'HKQuantityTypeIdentifierBodyMass'
  | 'HKQuantityTypeIdentifierBodyFatPercentage'
  | 'HKQuantityTypeIdentifierLeanBodyMass'
  | 'HKQuantityTypeIdentifierBodyMassIndex'
  | 'HKQuantityTypeIdentifierWaistCircumference'
  | 'HKQuantityTypeIdentifierHeartRate'
  | 'HKQuantityTypeIdentifierBloodPressureSystolic'
  | 'HKQuantityTypeIdentifierBloodPressureDiastolic';

export type HealthUnit = 'kg' | '%' | 'count' | 'm' | 'count/min';

export interface HealthSample {
  identifier: HealthIdentifier;
  unit: HealthUnit;
  value: number;
  /** Unix ms. */
  date: number;
  /** Stable id for "already synced" bookkeeping; see measurementKey. */
  key: string;
}

export const HEALTH_WRITE_TYPES: readonly HealthIdentifier[] = [
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierBodyFatPercentage',
  'HKQuantityTypeIdentifierLeanBodyMass',
  'HKQuantityTypeIdentifierBodyMassIndex',
  'HKQuantityTypeIdentifierWaistCircumference',
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierBloodPressureSystolic',
  'HKQuantityTypeIdentifierBloodPressureDiastolic',
];

export const measurementKey = (m: Measurement): string => `${m.type}|${m.site ?? ''}|${m.takenAt}`;

/**
 * HealthKit takes percentages as a fraction (0.206 for 20.6%) and lengths in metres, which is why
 * these are converted here and not at display time. Returns null for readings Apple Health has no
 * type for.
 */
export function toHealthSample(m: Measurement): HealthSample | null {
  const base = { date: m.takenAt, key: measurementKey(m) };
  switch (m.type) {
    case 'weight':
      return { ...base, identifier: 'HKQuantityTypeIdentifierBodyMass', unit: 'kg', value: m.value };
    case 'body_fat':
      return { ...base, identifier: 'HKQuantityTypeIdentifierBodyFatPercentage', unit: '%', value: m.value / 100 };
    case 'fat_free_mass':
      return { ...base, identifier: 'HKQuantityTypeIdentifierLeanBodyMass', unit: 'kg', value: m.value };
    case 'bmi':
      return { ...base, identifier: 'HKQuantityTypeIdentifierBodyMassIndex', unit: 'count', value: m.value };
    case 'circumference':
      return m.site === 'waist'
        ? { ...base, identifier: 'HKQuantityTypeIdentifierWaistCircumference', unit: 'm', value: m.value / 100 }
        : null;
    case 'pulse':
      return { ...base, identifier: 'HKQuantityTypeIdentifierHeartRate', unit: 'count/min', value: m.value };
    default:
      return null; // blood pressure goes through pendingBloodPressure: HealthKit wants it as a pair
  }
}

/** One cuff reading as HealthKit stores it: systolic and diastolic together, in mmHg. */
export interface BloodPressureSample extends BpContext {
  systolic: number;
  diastolic: number;
  /** Unix ms. */
  date: number;
  /** The two measurement keys this covers, recorded as synced once it is written. */
  keys: [string, string];
}

/** Readings with both halves present and neither already sent. A lone half is skipped, not guessed at. */
export function pendingBloodPressure(all: readonly Measurement[], synced: ReadonlySet<string>): BloodPressureSample[] {
  const sys = new Map<string, Measurement>();
  const dia = new Map<string, Measurement>();
  const context = new Map<string, Measurement[]>();
  for (const m of all) {
    const id = `${m.source}|${m.takenAt}`;
    if (m.type === 'bp_systolic') sys.set(id, m);
    else if (m.type === 'bp_diastolic') dia.set(id, m);
    else if (m.type === 'bp_arm' || m.type === 'bp_position') context.set(id, [...(context.get(id) ?? []), m]);
  }
  const out: BloodPressureSample[] = [];
  for (const [id, s] of sys) {
    const d = dia.get(id);
    if (!d) continue;
    const keys: [string, string] = [measurementKey(s), measurementKey(d)];
    if (synced.has(keys[0]) && synced.has(keys[1])) continue;
    out.push({ systolic: s.value, diastolic: d.value, date: s.takenAt, keys, ...bpContextOf(context.get(id) ?? []) });
  }
  return out;
}

export type HealthMetadata = Record<string, string | number>;

/**
 * What to attach to a blood-pressure entry about how it was taken, most to least informative.
 * HealthKit has no blood-pressure arm or position field, and the Health app shows neither, so this
 * is for other apps and exports that read the sample. `HKDevicePlacementSide` is Apple's own key for
 * the side of the body a device sat on (1 left, 2 right); the Keel keys are plain strings. The writer
 * tries each in turn and finally none, so a rejected key can never stop a reading from syncing.
 */
export function bloodPressureMetadataAttempts(s: BpContext): HealthMetadata[] {
  const custom: HealthMetadata = {};
  if (s.arm) custom.KeelBloodPressureArm = s.arm;
  if (s.position) custom.KeelBodyPosition = s.position;
  if (Object.keys(custom).length === 0) return [];
  if (!s.arm) return [custom];
  return [{ ...custom, HKDevicePlacementSide: s.arm === 'left' ? 1 : 2 }, custom];
}

/** The samples still to write: mappable and not in `synced`. */
export function pendingSamples(all: readonly Measurement[], synced: ReadonlySet<string>): HealthSample[] {
  const out: HealthSample[] = [];
  for (const m of all) {
    const s = toHealthSample(m);
    if (s && !synced.has(s.key)) out.push(s);
  }
  return out;
}
