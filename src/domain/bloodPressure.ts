import type { Measurement } from './measurement';

export type BpArm = 'left' | 'right';
export type BpPosition = 'sitting' | 'standing' | 'lying';

/** What the user tells us about how a reading was taken. Null means not recorded. */
export interface BpContext {
  arm: BpArm | null;
  position: BpPosition | null;
}

export const NO_BP_CONTEXT: BpContext = { arm: null, position: null };

export const BP_ARM_LABEL: Record<BpArm, string> = { left: 'Left arm', right: 'Right arm' };
export const BP_POSITION_LABEL: Record<BpPosition, string> = { sitting: 'Sitting', standing: 'Standing', lying: 'Lying down' };

const isArm = (s: string | undefined): s is BpArm => s === 'left' || s === 'right';
const isPosition = (s: string | undefined): s is BpPosition => s === 'sitting' || s === 'standing' || s === 'lying';

/** "Left arm · sitting", or null when nothing was recorded. */
export function bpContextText(c: BpContext): string | null {
  const parts = [c.arm ? BP_ARM_LABEL[c.arm] : null, c.position ? BP_POSITION_LABEL[c.position].toLowerCase() : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/** The stored rows for a context: one row per field that is set, none for the rest. */
export function bpContextMeasurements(source: string, takenAt: number, c: BpContext): Measurement[] {
  const out: Measurement[] = [];
  if (c.arm) out.push({ type: 'bp_arm', value: 1, takenAt, source, site: c.arm });
  if (c.position) out.push({ type: 'bp_position', value: 1, takenAt, source, site: c.position });
  return out;
}

/** The context held by a set of measurements (a reading's rows, or the whole list filtered to one reading). */
export function bpContextOf(list: readonly Measurement[]): BpContext {
  const arm = list.find((m) => m.type === 'bp_arm')?.site;
  const position = list.find((m) => m.type === 'bp_position')?.site;
  return { arm: isArm(arm) ? arm : null, position: isPosition(position) ? position : null };
}

export interface BpReading extends BpContext {
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
    if (!['bp_systolic', 'bp_diastolic', 'pulse', 'irregular_pulse', 'body_movement', 'bp_arm', 'bp_position'].includes(m.type)) continue;
    const id = `${m.source}|${m.takenAt}`;
    const r = byId.get(id) ?? { takenAt: m.takenAt };
    if (m.type === 'bp_systolic') r.systolic = m.value;
    else if (m.type === 'bp_diastolic') r.diastolic = m.value;
    else if (m.type === 'pulse') r.pulse = m.value;
    else if (m.type === 'irregular_pulse') r.irregularPulse = m.value > 0;
    else if (m.type === 'body_movement') r.bodyMovement = m.value > 0;
    else if (m.type === 'bp_arm') r.arm = isArm(m.site) ? m.site : null;
    else r.position = isPosition(m.site) ? m.site : null;
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
      arm: r.arm ?? null,
      position: r.position ?? null,
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
