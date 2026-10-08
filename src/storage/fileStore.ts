import { File, Paths } from 'expo-file-system';
import type { Measurement } from '@/domain/measurement';
import { parse, serialize } from './measurements';

// A single JSON file in the app's documents folder. Plenty for personal use; swap for SQLite if
// the history ever gets large.
const file = () => new File(Paths.document, 'measurements.json');

export function loadMeasurements(): Measurement[] {
  try {
    const f = file();
    return f.exists ? parse(f.textSync()) : [];
  } catch {
    return [];
  }
}

export function saveMeasurements(list: readonly Measurement[]): void {
  try {
    const f = file();
    if (!f.exists) f.create();
    f.write(serialize(list));
  } catch (e) {
    console.warn('[store] could not save measurements', e);
  }
}
