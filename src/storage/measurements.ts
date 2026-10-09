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

export const idOf = (m: Measurement) => `${m.source}|${m.type}|${m.site ?? ''}|${m.takenAt}`;

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

/** Everything that was saved in one go: a weigh-in (all its metrics) or a single tape reading. */
export interface Entry {
  id: string;
  kind: 'weigh-in' | 'tape';
  takenAt: number;
  measurements: Measurement[];
}

/** Newest first. Scale metrics sharing a source and timestamp are one weigh-in; each tape reading stands alone. */
export function groupEntries(list: readonly Measurement[]): Entry[] {
  const byId = new Map<string, Entry>();
  for (const m of list) {
    const tape = m.type === 'circumference';
    const id = tape ? idOf(m) : `${m.source}|${m.takenAt}`;
    const e = byId.get(id);
    if (e) e.measurements.push(m);
    else byId.set(id, { id, kind: tape ? 'tape' : 'weigh-in', takenAt: m.takenAt, measurements: [m] });
  }
  return [...byId.values()].sort((a, b) => b.takenAt - a.takenAt);
}

/** The list without the given entry's measurements. */
export function removeEntry(list: readonly Measurement[], entry: Entry): Measurement[] {
  const gone = new Set(entry.measurements.map(idOf));
  return list.filter((m) => !gone.has(idOf(m)));
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
