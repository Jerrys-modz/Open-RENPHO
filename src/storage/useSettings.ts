import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { NO_BP_CONTEXT, type BpArm, type BpContext, type BpPosition } from '@/domain/bloodPressure';
import { readDemoMode } from '@/demo';
import { defaultUnitSystem, type PressureUnit, type UnitSystem } from '@/util/units';

// Display preferences only; measurements are always stored in kg and cm.
const file = () => new File(Paths.document, 'settings.json');
const demo = readDemoMode() !== null;
let cache: UnitSystem | undefined;
let anyUserCache: boolean | undefined;
let pressureCache: PressureUnit | undefined;
let bpDefaultsCache: BpContext = NO_BP_CONTEXT;
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
          const data = JSON.parse(f.textSync()) as { units?: unknown; beurerAnyUser?: unknown; pressure?: unknown; bpArm?: unknown; bpPosition?: unknown };
          bpDefaultsCache = {
            arm: data.bpArm === 'left' || data.bpArm === 'right' ? data.bpArm : null,
            position: data.bpPosition === 'sitting' || data.bpPosition === 'standing' || data.bpPosition === 'lying' ? data.bpPosition : null,
          };
          if (data.pressure === 'mmHg' || data.pressure === 'kPa') pressureCache = data.pressure;
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
      f.writeSync(
        JSON.stringify({
          version: 1,
          units: cache,
          beurerAnyUser: anyUserCache === true,
          pressure: pressureCache ?? 'mmHg',
          bpArm: bpDefaultsCache.arm,
          bpPosition: bpDefaultsCache.position,
        }),
      );
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

/** Display only: blood pressure is always stored and synced in mmHg. */
export function getPressureUnit(): PressureUnit {
  snapshot();
  return pressureCache ?? 'mmHg';
}

export function setPressureUnit(unit: PressureUnit): void {
  snapshot();
  pressureCache = unit;
  persist();
}

export function usePressureUnit(): PressureUnit {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getPressureUnit,
    getPressureUnit,
  );
}

/** The arm and position applied to blood-pressure readings the next sync imports. Null means not recorded. */
export function getBpDefaults(): BpContext {
  snapshot();
  return bpDefaultsCache;
}

export function setBpDefaults(change: { arm?: BpArm | null; position?: BpPosition | null }): void {
  snapshot();
  bpDefaultsCache = { ...bpDefaultsCache, ...change };
  persist();
}

export function useBpDefaults(): BpContext {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getBpDefaults,
    getBpDefaults,
  );
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
