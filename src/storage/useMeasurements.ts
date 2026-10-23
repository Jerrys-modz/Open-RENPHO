import { useSyncExternalStore } from 'react';
import type { Measurement } from '@/domain/measurement';
import { backfillDerived } from '@/ble/qn/measurements';
import { demoMeasurements, readDemoMode } from '@/demo';
import { loadMeasurements, saveMeasurements } from './fileStore';
import { getProfile } from './useProfile';
import { appendMeasurements, removeEntry, type Entry } from './measurements';

// One in-memory copy shared by every screen, persisted to disk on every change.
let cache: Measurement[] | null = null;
const listeners = new Set<() => void>();
const demo = readDemoMode() !== null;

function snapshot(): Measurement[] {
  if (cache === null) {
    cache = demo ? demoMeasurements() : loadMeasurements();
    if (!demo) {
      // Weigh-ins saved before a stat existed (e.g. body fat mass) get it filled in from what they hold.
      const filled = backfillDerived(cache, getProfile()) as Measurement[];
      if (filled !== cache) {
        cache = filled;
        saveMeasurements(cache);
      }
    }
  }
  return cache;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** The current list, for code outside React (sync). */
export const getMeasurements = (): readonly Measurement[] => snapshot();

/** Re-runs the backfill, e.g. after the profile is saved so height and sex unlock the rest of the stats. */
export function backfillMeasurements(): void {
  if (demo) return;
  const before = snapshot();
  const filled = backfillDerived(before, getProfile()) as Measurement[];
  if (filled === before) return;
  cache = filled;
  saveMeasurements(cache);
  listeners.forEach((l) => l());
}

export function deleteEntry(entry: Entry): void {
  cache = removeEntry(snapshot(), entry);
  if (!demo) saveMeasurements(cache);
  listeners.forEach((l) => l());
}

export function addMeasurements(add: readonly Measurement[]): void {
  cache = appendMeasurements(snapshot(), add);
  if (!demo) saveMeasurements(cache); // demo mode never writes anything
  listeners.forEach((l) => l());
}

export function useMeasurements(): readonly Measurement[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
