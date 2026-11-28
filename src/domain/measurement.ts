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
  | 'circumference' // cm; see `site`
  | 'bp_systolic' // mmHg
  | 'bp_diastolic' // mmHg
  | 'pulse' // beats per minute, from a blood-pressure cuff
  | 'irregular_pulse' // 1 when the cuff flagged the reading; stored only when set
  | 'body_movement' // 1 when the cuff saw movement during the reading; stored only when set
  | 'bp_arm' // 1; `site` is 'left' or 'right': the arm the cuff was on
  | 'bp_position' // 1; `site` is 'sitting', 'standing', 'lying' or 'reclining'
  | 'bp_note'; // 1; `site` holds the note text (up to 500 characters)

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
