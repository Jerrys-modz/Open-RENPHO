import { bpContextMeasurements, NO_BP_CONTEXT, type BpContext, type BpDefaults } from '@/domain/bloodPressure';
import type { Measurement } from '@/domain/measurement';
import type { CuffReading } from './protocol';

export const IHEALTH_SOURCE = 'ihealth-kn550bt';

/** One cuff reading as systolic, diastolic and pulse sharing a timestamp, plus any arm and position given. */
export function readingToMeasurements(r: CuffReading, context: BpContext = NO_BP_CONTEXT): Measurement[] {
  const add = (type: Measurement['type'], value: number): Measurement => ({
    type,
    value,
    takenAt: r.takenAt,
    source: IHEALTH_SOURCE,
  });
  const out = [add('bp_systolic', r.systolic), add('bp_diastolic', r.diastolic), add('pulse', r.pulse)];
  // Flags are stored only when the cuff set them, so ordinary readings stay three rows.
  if (r.irregularPulse) out.push(add('irregular_pulse', 1));
  if (r.bodyMovement) out.push(add('body_movement', 1));
  return [...out, ...bpContextMeasurements(IHEALTH_SOURCE, r.takenAt, context)];
}

/**
 * What to store for a sync. The user's usual arm and position are applied only to readings we do not
 * already have: the cuff re-sends everything it holds, and an arm the user corrected in History must
 * not be overwritten by the default on the next sync.
 */
export function importedMeasurements(
  existing: readonly Measurement[],
  readings: readonly CuffReading[],
  defaults: BpDefaults,
): Measurement[] {
  const have = new Set(existing.filter((m) => m.source === IHEALTH_SOURCE && m.type === 'bp_systolic').map((m) => m.takenAt));
  return readings.flatMap((r) => readingToMeasurements(r, have.has(r.takenAt) ? NO_BP_CONTEXT : { ...defaults, note: null }));
}
