import { useSyncExternalStore } from 'react';
import type { Measurement } from '@/domain/measurement';
import { demoMeasurements, readDemoMode } from '@/demo';
import { loadMeasurements, saveMeasurements } from './fileStore';
import { appendMeasurements } from './measurements';

// One in-memory copy shared by every screen, persisted to disk on every change.
let cache: Measurement[] | null = null;
const listeners = new Set<() => void>();
const demo = readDemoMode() !== null;

function snapshot(): Measurement[] {
  cache ??= demo ? demoMeasurements() : loadMeasurements();
  return cache;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function addMeasurements(add: readonly Measurement[]): void {
  cache = appendMeasurements(snapshot(), add);
  if (!demo) saveMeasurements(cache); // demo mode never writes anything
  listeners.forEach((l) => l());
}

export function useMeasurements(): readonly Measurement[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
