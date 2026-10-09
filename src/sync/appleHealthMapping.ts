import type { Measurement } from '@/domain/measurement';

/** The HealthKit sample types we write. Everything else (water, bone, BMR...) has no Apple Health home. */
export type HealthIdentifier =
  | 'HKQuantityTypeIdentifierBodyMass'
  | 'HKQuantityTypeIdentifierBodyFatPercentage'
  | 'HKQuantityTypeIdentifierLeanBodyMass'
  | 'HKQuantityTypeIdentifierBodyMassIndex'
  | 'HKQuantityTypeIdentifierWaistCircumference';

export type HealthUnit = 'kg' | '%' | 'count' | 'm';

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
    default:
      return null;
  }
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
