/** Display units only. Everything is stored in kg and cm. */
export type UnitSystem = 'metric' | 'imperial';

export const LB_PER_KG = 2.2046226218;
export const CM_PER_IN = 2.54;

interface UnitLike {
  unit: string;
  digits: number;
}

/** Linear conversion, so it is also right for a change between two readings. */
export function convertValue(value: number, unit: string, system: UnitSystem): { value: number; unit: string } {
  if (system === 'imperial') {
    if (unit === 'kg') return { value: value * LB_PER_KG, unit: 'lb' };
    if (unit === 'cm') return { value: value / CM_PER_IN, unit: 'in' };
  }
  return { value, unit };
}

export function displayDigits(def: UnitLike, system: UnitSystem): number {
  return system === 'imperial' && (def.unit === 'kg' || def.unit === 'cm') ? 1 : def.digits;
}

export function formatForDisplay(def: UnitLike, value: number, system: UnitSystem): { text: string; unit: string } {
  const c = convertValue(value, def.unit, system);
  return { text: c.value.toFixed(displayDigits(def, system)), unit: c.unit };
}

/** "+0.5" style text for a change in `def`'s unit. */
export function formatDeltaForDisplay(def: UnitLike, delta: number, system: UnitSystem): { text: string; unit: string } {
  const c = convertValue(delta, def.unit, system);
  const digits = displayDigits(def, system);
  const s = c.value.toFixed(digits);
  const zero = Number(s) === 0;
  return { text: zero ? (0).toFixed(digits) : c.value > 0 ? `+${s}` : s, unit: c.unit };
}

const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM']);

/** US, Liberia and Myanmar use imperial; everyone else defaults to metric. */
export function defaultUnitSystem(locale: string | undefined): UnitSystem {
  const region = /[-_]([A-Za-z]{2})\b/.exec(locale ?? '')?.[1]?.toUpperCase();
  return region && IMPERIAL_REGIONS.has(region) ? 'imperial' : 'metric';
}

/** Height as the user would type it: cm, or total inches. */
export function heightToInput(cm: number, system: UnitSystem): string {
  return system === 'imperial' ? String(Math.round((cm / CM_PER_IN) * 10) / 10) : String(cm);
}

/**
 * Parses a height typed in the current system. Imperial accepts 70, 70.5, or 5'10 / 5' 10" / 5 ft 10.
 * Returns NaN when it cannot be understood.
 */
export function parseHeightToCm(text: string, system: UnitSystem): number {
  const t = text.trim().replace(',', '.');
  if (system === 'metric') return Number(t);
  const ftIn = /^(\d+)\s*(?:'|′|ft|feet)\s*(\d{1,2}(?:\.\d+)?)?\s*(?:"|″|in|inches)?$/i.exec(t);
  if (ftIn) return (Number(ftIn[1]) * 12 + Number(ftIn[2] ?? 0)) * CM_PER_IN;
  const inches = Number(t);
  return Number.isFinite(inches) && t !== '' ? inches * CM_PER_IN : NaN;
}
