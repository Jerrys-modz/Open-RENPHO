import type { Measurement } from '@/domain/measurement';
import type { WeighIn } from './session';

export const QN_SOURCE = 'qn-scale';

/** Turns a finished weigh-in into stored measurements, all sharing one timestamp. */
export function weighInToMeasurements(w: WeighIn, takenAt: number): Measurement[] {
  const out: Measurement[] = [{ type: 'weight', value: w.weightKg, takenAt, source: QN_SOURCE }];
  if (w.bodyFat !== null && w.bodyFat > 0) {
    out.push({ type: 'body_fat', value: w.bodyFat, takenAt, source: QN_SOURCE });
  }
  if (w.resistance1 !== null && w.resistance1 > 0) {
    out.push({ type: 'impedance', value: w.resistance1, takenAt, source: QN_SOURCE });
  }
  return out;
}
