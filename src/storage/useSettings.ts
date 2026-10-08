import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { readDemoMode } from '@/demo';
import { defaultUnitSystem, type UnitSystem } from '@/util/units';

// Display preferences only; measurements are always stored in kg and cm.
const file = () => new File(Paths.document, 'settings.json');
const demo = readDemoMode() !== null;
let cache: UnitSystem | undefined;
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
          const saved = (JSON.parse(f.textSync()) as { units?: unknown }).units;
          if (saved === 'metric' || saved === 'imperial') cache = saved;
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

export function setUnits(units: UnitSystem): void {
  cache = units;
  if (!demo) {
    try {
      const f = file();
      if (!f.exists) f.create();
      f.write(JSON.stringify({ version: 1, units }));
    } catch (e) {
      console.warn('[settings] could not save', e);
    }
  }
  listeners.forEach((l) => l());
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
