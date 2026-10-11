import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { readDemoMode } from '@/demo';
import { defaultUnitSystem, type UnitSystem } from '@/util/units';

// Display preferences only; measurements are always stored in kg and cm.
const file = () => new File(Paths.document, 'settings.json');
const demo = readDemoMode() !== null;
let cache: UnitSystem | undefined;
let anyUserCache: boolean | undefined;
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
    anyUserCache = false;
    if (!demo) {
      try {
        const f = file();
        if (f.exists) {
          const data = JSON.parse(f.textSync()) as { units?: unknown; beurerAnyUser?: unknown };
          if (data.units === 'metric' || data.units === 'imperial') cache = data.units;
          anyUserCache = data.beurerAnyUser === true;
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

function persist(): void {
  if (!demo) {
    try {
      const f = file();
      if (!f.exists) f.create();
      f.write(JSON.stringify({ version: 1, units: cache, beurerAnyUser: anyUserCache === true }));
    } catch (e) {
      console.warn('[settings] could not save', e);
    }
  }
  listeners.forEach((l) => l());
}

export function setUnits(units: UnitSystem): void {
  snapshot();
  cache = units;
  persist();
}

/** Whether to take Beurer weigh-ins the scale files under another user slot. Off by default. */
export function getBeurerAnyUser(): boolean {
  snapshot();
  return anyUserCache === true;
}

export function setBeurerAnyUser(on: boolean): void {
  snapshot();
  anyUserCache = on;
  persist();
}

export function useBeurerAnyUser(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getBeurerAnyUser,
    getBeurerAnyUser,
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
