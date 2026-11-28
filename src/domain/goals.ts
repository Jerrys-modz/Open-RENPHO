import { readingsInWindow, type BpReading } from './bloodPressure';

/** A weight to reach, and the weight when the goal was set (progress is counted from there). */
export interface WeightGoal {
  targetKg: number;
  startKg: number;
}

/** A reading meets the target when both numbers are below it, in mmHg. */
export interface BpTarget {
  systolic: number;
  diastolic: number;
}

export interface Goals {
  weight: WeightGoal | null;
  bp: BpTarget | null;
}

export const NO_GOALS: Goals = { weight: null, bp: null };

/** The ACC/AHA target for most adults: below 130/80. */
export const DEFAULT_BP_TARGET: BpTarget = { systolic: 130, diastolic: 80 };

/** Null when fine, otherwise a message for the user. */
export function validateWeightGoal(targetKg: number, startKg: number): string | null {
  if (!Number.isFinite(targetKg) || targetKg < 20 || targetKg > 400) return 'Enter a target weight between 20 and 400 kg (44 to 880 lb).';
  if (!Number.isFinite(startKg)) return 'Weigh in once first, so Keel can show your progress from today.';
  if (Math.abs(targetKg - startKg) < 0.1) return 'Your target is the same as your current weight.';
  return null;
}

export function validateBpTarget(t: BpTarget): string | null {
  if (!Number.isFinite(t.systolic) || t.systolic < 90 || t.systolic > 200) return 'Systolic target must be between 90 and 200 mmHg.';
  if (!Number.isFinite(t.diastolic) || t.diastolic < 50 || t.diastolic > 130) return 'Diastolic target must be between 50 and 130 mmHg.';
  if (t.systolic <= t.diastolic) return 'Systolic must be higher than diastolic.';
  return null;
}

export interface WeightProgress {
  /** 0 to 1, how much of the way from the starting weight to the target. */
  fraction: number;
  remainingKg: number;
  reached: boolean;
  direction: 'lose' | 'gain';
}

export function weightProgress(goal: WeightGoal, currentKg: number): WeightProgress {
  const lose = goal.startKg > goal.targetKg;
  const span = Math.abs(goal.startKg - goal.targetKg);
  const done = lose ? goal.startKg - currentKg : currentKg - goal.startKg;
  const remainingKg = Math.max(lose ? currentKg - goal.targetKg : goal.targetKg - currentKg, 0);
  return {
    fraction: span === 0 ? 1 : Math.min(Math.max(done / span, 0), 1),
    remainingKg,
    reached: remainingKg === 0,
    direction: lose ? 'lose' : 'gain',
  };
}

export const meetsBpTarget = (r: Pick<BpReading, 'systolic' | 'diastolic'>, t: BpTarget): boolean =>
  r.systolic < t.systolic && r.diastolic < t.diastolic;

/** How many readings in the `days` up to the newest met the target. Null with no readings. */
export function bpTargetShare(readings: readonly BpReading[], target: BpTarget, days: number): { meeting: number; total: number } | null {
  const inWindow = readingsInWindow(readings, days);
  if (inWindow.length === 0) return null;
  return { meeting: inWindow.filter((r) => meetsBpTarget(r, target)).length, total: inWindow.length };
}

export function serializeGoals(g: Goals): string {
  return JSON.stringify({ version: 1, ...g });
}

const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** Tolerant: anything unreadable or invalid gives no goal. */
export function parseGoals(text: string): Goals {
  try {
    const d = JSON.parse(text) as { weight?: { targetKg?: unknown; startKg?: unknown } | null; bp?: { systolic?: unknown; diastolic?: unknown } | null };
    const w = d.weight;
    const b = d.bp;
    const weight = w && num(w.targetKg) && num(w.startKg) && validateWeightGoal(w.targetKg, w.startKg) === null ? { targetKg: w.targetKg, startKg: w.startKg } : null;
    const bp = b && num(b.systolic) && num(b.diastolic) && validateBpTarget({ systolic: b.systolic, diastolic: b.diastolic }) === null ? { systolic: b.systolic, diastolic: b.diastolic } : null;
    return { weight, bp };
  } catch {
    return NO_GOALS;
  }
}
