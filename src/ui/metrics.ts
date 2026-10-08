import type { SeriesKey } from '@/storage/measurements';

export interface MetricDef {
  id: string;
  key: SeriesKey;
  label: string;
  unit: string;
  digits: number;
  /** openScale-style colour coding: one colour per metric. */
  color: string;
  symbol: string;
}

const circ = (site: string, color: string): MetricDef => ({
  id: site,
  key: { type: 'circumference', site },
  label: site[0].toUpperCase() + site.slice(1),
  unit: 'cm',
  digits: 1,
  color,
  symbol: 'ruler.fill',
});

export const METRICS: readonly MetricDef[] = [
  { id: 'weight', key: { type: 'weight' }, label: 'Weight', unit: 'kg', digits: 1, color: '#7e57c2', symbol: 'scalemass.fill' },
  { id: 'body_fat', key: { type: 'body_fat' }, label: 'Body fat', unit: '%', digits: 1, color: '#ef5350', symbol: 'percent' },
  circ('waist', '#ffca28'),
  circ('hips', '#ff7043'),
  circ('chest', '#26a69a'),
  circ('neck', '#ab47bc'),
  circ('bicep', '#42a5f5'),
  circ('thigh', '#9ccc65'),
  circ('calf', '#8d6e63'),
];

export const SITES = METRICS.filter((m) => m.key.type === 'circumference').map((m) => m.key.site as string);

export const metricById = (id: string): MetricDef => METRICS.find((m) => m.id === id) ?? METRICS[0];
