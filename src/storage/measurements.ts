/** Pure helpers over a flat list of measurements. No I/O. */
import type { Measurement, MeasurementType } from '@/domain/measurement';

export interface SeriesKey {
  type: MeasurementType;
  site?: string;
}

export interface Point {
  t: number;
  v: number;
}

export function matches(m: Measurement, key: SeriesKey): boolean {
  return m.type === key.type && (key.site === undefined || m.site === key.site);
}

/** Oldest first. */
export function seriesFor(list: readonly Measurement[], key: SeriesKey): Point[] {
  return list
    .filter((m) => matches(m, key))
    .map((m) => ({ t: m.takenAt, v: m.value }))
    .sort((a, b) => a.t - b.t);
}

export interface LatestValue {
  point: Point;
  /** Change since the previous reading, or null if there is none. */
  delta: number | null;
}

export function latestWithDelta(list: readonly Measurement[], key: SeriesKey): LatestValue | null {
  const s = seriesFor(list, key);
  if (s.length === 0) return null;
  const point = s[s.length - 1];
  return { point, delta: s.length > 1 ? point.v - s[s.length - 2].v : null };
}

const idOf = (m: Measurement) => `${m.source}|${m.type}|${m.site ?? ''}|${m.takenAt}`;

/** Adds measurements, ignoring any already present (same source, type, site and time). */
export function appendMeasurements(
  list: readonly Measurement[],
  add: readonly Measurement[],
): Measurement[] {
  const seen = new Set(list.map(idOf));
  const out = [...list];
  for (const m of add) {
    const id = idOf(m);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(m);
  }
  return out;
}

export function serialize(list: readonly Measurement[]): string {
  return JSON.stringify({ version: 1, measurements: list });
}

const isMeasurement = (x: unknown): x is Measurement => {
  const m = x as Measurement;
  return (
    typeof m === 'object' &&
    m !== null &&
    typeof m.type === 'string' &&
    typeof m.value === 'number' &&
    Number.isFinite(m.value) &&
    typeof m.takenAt === 'number' &&
    typeof m.source === 'string' &&
    (m.site === undefined || typeof m.site === 'string')
  );
};

/** Tolerant: returns [] for anything unreadable and drops invalid entries. */
export function parse(text: string): Measurement[] {
  try {
    const data = JSON.parse(text) as { measurements?: unknown };
    return Array.isArray(data.measurements) ? data.measurements.filter(isMeasurement) : [];
  } catch {
    return [];
  }
}
