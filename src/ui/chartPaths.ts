import type { Point } from '@/storage/measurements';

export interface ChartGeometry {
  line: string;
  area: string;
  min: number;
  max: number;
  last: { x: number; y: number } | null;
  /** Where each input point landed, same order as the input. */
  coords: { x: number; y: number }[];
}

export interface Padding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

const DEFAULT_PAD: Padding = { top: 12, bottom: 12, left: 8, right: 8 };

const r = (n: number) => Math.round(n * 10) / 10;

/** SVG path data for a line and its filled area, scaled into width x height. Points must be oldest first. */
export function buildChart(
  points: readonly Point[],
  width: number,
  height: number,
  pad: Padding = DEFAULT_PAD,
): ChartGeometry {
  if (points.length === 0 || width <= 0 || height <= 0) {
    return { line: '', area: '', min: 0, max: 0, last: null, coords: [] };
  }
  const vs = points.map((p) => p.v);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const bottom = height - pad.bottom;

  const x = (t: number) => (t1 === t0 ? pad.left + innerW / 2 : pad.left + ((t - t0) / (t1 - t0)) * innerW);
  const y = (v: number) => (max === min ? pad.top + innerH / 2 : pad.top + (1 - (v - min) / (max - min)) * innerH);

  const xy = points.map((p) => ({ x: r(x(p.t)), y: r(y(p.v)) }));
  const line = xy.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
  const area =
    xy.length > 1 ? `${line} L${xy[xy.length - 1].x} ${r(bottom)} L${xy[0].x} ${r(bottom)} Z` : '';
  return { line, area, min, max, last: xy[xy.length - 1], coords: xy };
}

/** Index of the point whose x is closest to `x`, or -1 when there are no points. Coords are left to right. */
export function nearestIndex(coords: readonly { x: number }[], x: number): number {
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = Math.abs(coords[i].x - x);
    if (d < bestDist) {
      best = i;
      bestDist = d;
    }
  }
  return best;
}

export interface BandChartGeometry {
  systolicLine: string;
  diastolicLine: string;
  /** The filled region between the diastolic and systolic lines. */
  band: string;
  min: number;
  max: number;
  /** Where each reading landed, same order as the input: x, systolic y and diastolic y. */
  coords: { x: number; ys: number; yd: number }[];
}

/** Two lines on one shared scale with the space between them filled. Readings must be oldest first. */
export function buildBandChart(
  readings: readonly { t: number; sys: number; dia: number }[],
  width: number,
  height: number,
  pad: Padding = DEFAULT_PAD,
): BandChartGeometry {
  if (readings.length === 0 || width <= 0 || height <= 0) {
    return { systolicLine: '', diastolicLine: '', band: '', min: 0, max: 0, coords: [] };
  }
  const min = Math.min(...readings.map((p) => p.dia));
  const max = Math.max(...readings.map((p) => p.sys));
  const t0 = readings[0].t;
  const t1 = readings[readings.length - 1].t;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const x = (t: number) => (t1 === t0 ? pad.left + innerW / 2 : pad.left + ((t - t0) / (t1 - t0)) * innerW);
  const y = (v: number) => (max === min ? pad.top + innerH / 2 : pad.top + (1 - (v - min) / (max - min)) * innerH);

  const coords = readings.map((p) => ({ x: r(x(p.t)), ys: r(y(p.sys)), yd: r(y(p.dia)) }));
  const path = (pick: (c: (typeof coords)[number]) => number) =>
    coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x} ${pick(c)}`).join(' ');
  const systolicLine = path((c) => c.ys);
  const diastolicLine = path((c) => c.yd);
  const back = [...coords].reverse().map((c) => `L${c.x} ${c.yd}`).join(' ');
  const band = coords.length > 1 ? `${systolicLine} ${back} Z` : '';
  return { systolicLine, diastolicLine, band, min, max, coords };
}

/** Index of the reading whose x is closest to `x` (same job as nearestIndex, for the band chart). */
export function nearestBandIndex(coords: readonly { x: number }[], x: number): number {
  return nearestIndex(coords, x);
}
