import type { MeasurementType } from '@/domain/measurement';
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

const scale = (
  type: MeasurementType,
  label: string,
  unit: string,
  digits: number,
  color: string,
  symbol: string,
): MetricDef => ({ id: type, key: { type }, label, unit, digits, color, symbol });

const circ = (site: string, color: string): MetricDef => ({
  id: site,
  key: { type: 'circumference', site },
  label: site[0].toUpperCase() + site.slice(1),
  unit: 'cm',
  digits: 1,
  color,
  symbol: 'ruler.fill',
});

/** Everything the scale produces, in the order they are listed. */
export const SCALE_METRICS: readonly MetricDef[] = [
  scale('weight', 'Weight', 'kg', 1, '#7e57c2', 'scalemass.fill'),
  scale('body_fat', 'Body fat', '%', 1, '#ef5350', 'percent'),
  scale('fat_mass', 'Body fat mass', 'kg', 1, '#e57373', 'chart.pie.fill'),
  scale('bmi', 'BMI', '', 1, '#ec407a', 'figure.stand'),
  scale('body_water', 'Water', '%', 1, '#29b6f6', 'drop.fill'),
  scale('body_water_mass', 'Water mass', 'kg', 1, '#4fc3f7', 'drop.halffull'),
  scale('muscle_percent', 'Muscle %', '%', 1, '#43a047', 'figure.arms.open'),
  scale('muscle_mass', 'Muscle mass', 'kg', 1, '#66bb6a', 'dumbbell.fill'),
  scale('skeletal_muscle', 'Skeletal muscle', '%', 1, '#5c6bc0', 'figure.strengthtraining.traditional'),
  scale('skeletal_muscle_mass', 'Skeletal muscle mass', 'kg', 1, '#7986cb', 'figure.strengthtraining.functional'),
  scale('fat_free_mass', 'Fat-free mass', 'kg', 1, '#9ccc65', 'figure.walk'),
  scale('soft_lean_mass', 'Soft lean mass', 'kg', 1, '#aed581', 'figure.mixed.cardio'),
  scale('bone_mass', 'Bone mass', 'kg', 2, '#d4a373', 'bandage.fill'),
  scale('bone_percent', 'Bone %', '%', 1, '#c9a27c', 'percent'),
  scale('protein', 'Protein', '%', 1, '#ff8a65', 'fork.knife'),
  scale('protein_mass', 'Protein mass', 'kg', 1, '#ffab91', 'fork.knife.circle'),
  scale('bmr', 'BMR', 'kcal', 0, '#ffb300', 'flame.fill'),
];

export const TAPE_METRICS: readonly MetricDef[] = [
  circ('waist', '#ffca28'),
  circ('hips', '#ff7043'),
  circ('chest', '#26a69a'),
  circ('neck', '#ab47bc'),
  circ('bicep', '#42a5f5'),
  circ('thigh', '#cddc39'),
  circ('calf', '#8d6e63'),
];

export const METRICS: readonly MetricDef[] = [...SCALE_METRICS, ...TAPE_METRICS];

export const SITES = TAPE_METRICS.map((m) => m.key.site as string);

export const metricById = (id: string): MetricDef => METRICS.find((m) => m.id === id) ?? METRICS[0];
export const metricForType = (type: MeasurementType): MetricDef | undefined =>
  SCALE_METRICS.find((m) => m.key.type === type);
