import type { Measurement } from '@/domain/measurement';
import { measurementKey } from './appleHealthMapping';

/**
 * One record for POST /api/health-data. Type names come from SparkyFitness's server
 * (SparkyFitnessServer/services/healthDataHandlers.ts): matching is exact and case-sensitive, and
 * anything it does not know becomes a custom measurement category.
 */
export interface SparkyRecord {
  type: string;
  value: number;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** ISO 8601, so the server can keep the time of day. */
  timestamp: string;
  /** Only read for custom measurements. */
  unit?: string;
}

export interface SparkyItem {
  /** Same key as Apple Health uses, for "already sent" bookkeeping. */
  key: string;
  takenAt: number;
  record: SparkyRecord;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** The user's local calendar date (not UTC, so an evening weigh-in stays on its day). */
export function localDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Types SparkyFitness stores in its own check-in fields; value units are the ones noted. */
const BUILT_IN: Partial<Record<Measurement['type'], { type: string }>> = {
  weight: { type: 'weight' }, // kg
  body_fat: { type: 'body_fat' }, // 0-100 %
  muscle_mass: { type: 'muscle_mass_kg' },
  bone_mass: { type: 'bone_mass_kg' },
  body_water: { type: 'body_water_percentage' }, // 0-100 %
  bmr: { type: 'bmr' }, // kcal
};

/** Not built in; sent as custom measurements only when the user opts in. */
const EXTRAS: Partial<Record<Measurement['type'], { type: string; unit: string }>> = {
  bmi: { type: 'BMI', unit: '' },
  fat_free_mass: { type: 'Fat Free Mass', unit: 'kg' },
  skeletal_muscle: { type: 'Skeletal Muscle', unit: '%' },
  protein: { type: 'Protein', unit: '%' },
  impedance: { type: 'Impedance', unit: 'ohm' },
};

const BUILT_IN_SITES = new Set(['waist', 'hips', 'neck']);

export function toSparkyItem(m: Measurement, includeExtras: boolean): SparkyItem | null {
  const base = { date: localDate(m.takenAt), timestamp: new Date(m.takenAt).toISOString() };
  const item = (type: string, unit?: string): SparkyItem => ({
    key: measurementKey(m),
    takenAt: m.takenAt,
    record: { type, value: m.value, ...base, ...(unit !== undefined ? { unit } : {}) },
  });

  if (m.type === 'circumference') {
    if (!m.site) return null;
    // Waist, hips and neck are built in (cm). Other sites become custom measurements.
    return BUILT_IN_SITES.has(m.site)
      ? item(m.site)
      : item(m.site[0].toUpperCase() + m.site.slice(1), 'cm');
  }
  const built = BUILT_IN[m.type];
  if (built) return item(built.type);
  const extra = EXTRAS[m.type];
  return extra && includeExtras ? item(extra.type, extra.unit) : null;
}

/**
 * Readings still to send, oldest first. SparkyFitness keeps one value per field per day and the
 * later record wins, so ascending order leaves the day's last weigh-in as the stored one.
 */
export function pendingSparkyItems(
  all: readonly Measurement[],
  synced: ReadonlySet<string>,
  includeExtras: boolean,
): SparkyItem[] {
  const out: SparkyItem[] = [];
  for (const m of all) {
    const it = toSparkyItem(m, includeExtras);
    if (it && !synced.has(it.key)) out.push(it);
  }
  return out.sort((a, b) => a.takenAt - b.takenAt);
}
