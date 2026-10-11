/**
 * A single reading, independent of which device produced it or where it is
 * synced. Units are fixed (SI-ish) so sync targets only convert at the edge.
 */
export type MeasurementType =
  | 'weight' // kg
  | 'body_fat' // %
  | 'body_water' // %
  | 'muscle_mass' // kg
  | 'skeletal_muscle' // %
  | 'bone_mass' // kg
  | 'fat_free_mass' // kg
  | 'protein' // %
  | 'bmi'
  | 'fat_mass' // kg
  | 'muscle_percent' // %
  | 'skeletal_muscle_mass' // kg
  | 'bone_percent' // %
  | 'body_water_mass' // kg
  | 'protein_mass' // kg
  | 'soft_lean_mass' // kg; only scales that report it
  | 'bmr' // kcal/day
  | 'impedance' // ohms
  | 'circumference'; // cm; see `site`

export interface Measurement {
  type: MeasurementType;
  value: number;
  /** Unix ms. */
  takenAt: number;
  /** Which driver produced this, e.g. "qn-scale". */
  source: string;
  /** Body site for tape readings, e.g. "waist". */
  site?: string;
}
