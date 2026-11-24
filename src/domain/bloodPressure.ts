import type { Measurement } from './measurement';

export interface BpReading {
  takenAt: number;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  irregularPulse: boolean;
  bodyMovement: boolean;
}

/** Assembles stored measurements into cuff readings (same source and time), newest first. */
export function bpReadings(list: readonly Measurement[]): BpReading[] {
  const byId = new Map<string, Partial<BpReading> & { takenAt: number }>();
  for (const m of list) {
    if (!['bp_systolic', 'bp_diastolic', 'pulse', 'irregular_pulse', 'body_movement'].includes(m.type)) continue;
    const id = `${m.source}|${m.takenAt}`;
    const r = byId.get(id) ?? { takenAt: m.takenAt };
    if (m.type === 'bp_systolic') r.systolic = m.value;
    else if (m.type === 'bp_diastolic') r.diastolic = m.value;
    else if (m.type === 'pulse') r.pulse = m.value;
    else if (m.type === 'irregular_pulse') r.irregularPulse = m.value > 0;
    else r.bodyMovement = m.value > 0;
    byId.set(id, r);
  }
  const out: BpReading[] = [];
  for (const r of byId.values()) {
    if (r.systolic === undefined || r.diastolic === undefined) continue; // half a reading is not shown
    out.push({
      takenAt: r.takenAt,
      systolic: r.systolic,
      diastolic: r.diastolic,
      pulse: r.pulse ?? null,
      irregularPulse: r.irregularPulse === true,
      bodyMovement: r.bodyMovement === true,
    });
  }
  return out.sort((a, b) => b.takenAt - a.takenAt);
}

export type BpCategory = 'normal' | 'elevated' | 'stage1' | 'stage2' | 'crisis';

export const BP_CATEGORY_LABEL: Record<BpCategory, string> = {
  normal: 'Normal',
  elevated: 'Elevated',
  stage1: 'High, stage 1',
  stage2: 'High, stage 2',
  crisis: 'Very high: seek care',
};

export const BP_CATEGORY_COLOR: Record<BpCategory, string> = {
  normal: '#43a047',
  elevated: '#f9a825',
  stage1: '#fb8c00',
  stage2: '#e53935',
  crisis: '#b71c1c',
};

/** ACC/AHA 2017 adult categories, from a single reading in mmHg. For information, not diagnosis. */
export function classifyBp(systolic: number, diastolic: number): BpCategory {
  if (systolic > 180 || diastolic > 120) return 'crisis';
  if (systolic >= 140 || diastolic >= 90) return 'stage2';
  if (systolic >= 130 || diastolic >= 80) return 'stage1';
  if (systolic >= 120) return 'elevated';
  return 'normal';
}

export interface BpAverage {
  systolic: number;
  diastolic: number;
  pulse: number | null;
  count: number;
}

const DAY = 24 * 60 * 60 * 1000;

/** Average of the readings in the `days` up to and including the newest one. Null when there are none. */
export function averageBp(readings: readonly BpReading[], days: number): BpAverage | null {
  if (readings.length === 0) return null;
  const newest = Math.max(...readings.map((r) => r.takenAt));
  const inWindow = readings.filter((r) => r.takenAt > newest - days * DAY);
  const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
  const pulses = inWindow.flatMap((r) => (r.pulse === null ? [] : [r.pulse]));
  return {
    systolic: mean(inWindow.map((r) => r.systolic)),
    diastolic: mean(inWindow.map((r) => r.diastolic)),
    pulse: pulses.length ? mean(pulses) : null,
    count: inWindow.length,
  };
}
