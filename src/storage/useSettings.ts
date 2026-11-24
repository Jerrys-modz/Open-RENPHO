import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { readDemoMode } from '@/demo';
import { defaultUnitSystem, type PressureUnit, type UnitSystem } from '@/util/units';

// Display preferences only; measurements are always stored in kg and cm.
const file = () => new File(Paths.document, 'settings.json');
const demo = readDemoMode() !== null;
let cache: UnitSystem | undefined;
let pressureCache: PressureUnit | undefined;
const listeners = new Set<() => void>();

function systemLocale(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
}

function snapshot(): UnitSystem {
  if (cache === undefined) {
    cache = demo ? 'imperial' : defaultUnitSystem(systemLocale());
    if (!demo) {
      try {
        const f = file();
        if (f.exists) {
          const saved = JSON.parse(f.textSync()) as { units?: unknown; pressure?: unknown };
          if (saved.units === 'metric' || saved.units === 'imperial') cache = saved.units;
          if (saved.pressure === 'mmHg' || saved.pressure === 'kPa') pressureCache = saved.pressure;
        }
      } catch {
        // keep the locale default
      }
    }
  }
  return cache;
}

export function getUnits(): UnitSystem {
  return snapshot();
}

function pressureSnapshot(): PressureUnit {
  snapshot(); // loads the file, which fills pressureCache if it was saved
  return pressureCache ?? 'mmHg';
}

function persist(): void {
  if (demo) return;
  try {
    const f = file();
    if (!f.exists) f.create();
    f.write(JSON.stringify({ version: 1, units: snapshot(), pressure: pressureSnapshot() }));
  } catch (e) {
    console.warn('[settings] could not save', e);
  }
}

export function setUnits(units: UnitSystem): void {
  cache = units;
  persist();
  listeners.forEach((l) => l());
}

export function setPressureUnit(unit: PressureUnit): void {
  snapshot();
  pressureCache = unit;
  persist();
  listeners.forEach((l) => l());
}

/** Display only: blood pressure is always stored and synced in mmHg. */
export function usePressureUnit(): PressureUnit {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    pressureSnapshot,
    pressureSnapshot,
  );
}

/** The unit system for display. Defaults to imperial in the US and metric elsewhere. */
export function useUnits(): UnitSystem {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    snapshot,
    snapshot,
  );
}
