import type { Measurement } from '@/domain/measurement';

const UNIT: Record<string, string> = {
  weight: 'kg',
  body_fat: '%',
  body_water: '%',
  muscle_mass: 'kg',
  skeletal_muscle: '%',
  bone_mass: 'kg',
  fat_free_mass: 'kg',
  protein: '%',
  bmr: 'kcal',
  impedance: 'ohm',
  circumference: 'cm',
  bp_systolic: 'mmHg',
  bp_diastolic: 'mmHg',
  pulse: 'bpm',
};

const cell = (v: string | number): string => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Every stored measurement, oldest first, one per row, always in the app's storage units (kg, cm, mmHg). */
export function measurementsToCsv(list: readonly Measurement[]): string {
  const rows = [...list].sort((a, b) => a.takenAt - b.takenAt || a.type.localeCompare(b.type));
  const lines = ['time_utc,type,site,value,unit,source'];
  for (const m of rows) {
    lines.push(
      [new Date(m.takenAt).toISOString(), m.type, m.site ?? '', m.value, UNIT[m.type] ?? '', m.source].map(cell).join(','),
    );
  }
  return lines.join('\n') + '\n';
}
