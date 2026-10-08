import type { Point } from '@/storage/measurements';

export interface ChartGeometry {
  line: string;
  area: string;
  min: number;
  max: number;
  last: { x: number; y: number } | null;
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
    return { line: '', area: '', min: 0, max: 0, last: null };
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
  return { line, area, min, max, last: xy[xy.length - 1] };
}
