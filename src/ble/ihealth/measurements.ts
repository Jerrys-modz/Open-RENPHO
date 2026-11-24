import type { Measurement } from '@/domain/measurement';
import type { CuffReading } from './protocol';

export const IHEALTH_SOURCE = 'ihealth-kn550bt';

/** One cuff reading as systolic, diastolic and pulse sharing a timestamp. */
export function readingToMeasurements(r: CuffReading): Measurement[] {
  const add = (type: Measurement['type'], value: number): Measurement => ({
    type,
    value,
    takenAt: r.takenAt,
    source: IHEALTH_SOURCE,
  });
  return [add('bp_systolic', r.systolic), add('bp_diastolic', r.diastolic), add('pulse', r.pulse)];
}
