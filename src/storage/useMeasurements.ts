import { useSyncExternalStore } from 'react';
import type { Measurement } from '@/domain/measurement';
import { backfillForPeople } from '@/ble/qn/measurements';
import { demoMeasurements, readDemoMode } from '@/demo';
import type { BpContext } from '@/domain/bloodPressure';
import { PRIMARY_PERSON, forPerson, measurementsOf, withoutPerson } from '@/domain/people';
import { loadMeasurements, saveMeasurements } from './fileStore';
import { appendMeasurements, removeEntry, withBpContext, type Entry } from './measurements';
import { getActivePersonId, subscribePeople } from './usePeople';
import { getProfileFor } from './useProfile';

// One in-memory copy shared by every screen, persisted to disk on every change. It holds every person's readings;
// screens see only the active person's (see useMeasurements), and sync sees only the primary person's.
let cache: Measurement[] | null = null;
const listeners = new Set<() => void>();
const demo = readDemoMode() !== null;

function snapshot(): Measurement[] {
  if (cache === null) {
    cache = demo ? demoMeasurements() : loadMeasurements();
    if (!demo) {
      // Weigh-ins saved before a stat existed (e.g. body fat mass) get it filled in from what they hold.
      const filled = backfillForPeople(cache, getProfileFor) as Measurement[];
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
  const off = subscribePeople(cb);
  return () => {
    listeners.delete(cb);
    off();
  };
}

const notify = () => listeners.forEach((l) => l());

/** Everyone's readings, for code that must see all of them. Prefer the helpers below. */
export const getMeasurements = (): readonly Measurement[] => snapshot();

/** Only the primary person's readings: the only ones sent to Apple Health or SparkyFitness, which are one person's accounts. */
export const getPrimaryMeasurements = (): readonly Measurement[] => measurementsOf(snapshot(), PRIMARY_PERSON);

/** Re-runs the backfill, e.g. after the profile is saved so height and sex unlock the rest of the stats. */
export function backfillMeasurements(): void {
  if (demo) return;
  const before = snapshot();
  const filled = backfillForPeople(before, getProfileFor) as Measurement[];
  if (filled === before) return;
  cache = filled;
  saveMeasurements(cache);
  notify();
}

export function deleteEntry(entry: Entry): void {
  cache = removeEntry(snapshot(), entry);
  if (!demo) saveMeasurements(cache);
  notify();
}

/** Records or changes the arm and position of one cuff reading of the active person. Does not reach Apple Health if the reading was already sent. */
export function setBpContext(source: string, takenAt: number, context: BpContext): void {
  cache = withBpContext(snapshot(), source, takenAt, context, getActivePersonId());
  if (!demo) saveMeasurements(cache);
  notify();
}

/** Adds readings to the active person. */
export function addMeasurements(add: readonly Measurement[]): void {
  cache = appendMeasurements(snapshot(), forPerson(add, getActivePersonId()));
  if (!demo) saveMeasurements(cache); // demo mode never writes anything
  notify();
}

/** Deletes everything one person has recorded. */
export function removePersonData(personId: string): void {
  cache = withoutPerson(snapshot(), personId);
  if (!demo) saveMeasurements(cache);
  notify();
}

// The active person's readings, rebuilt only when the data or the active person changes, so the array is stable between renders.
let memo: { source: Measurement[]; id: string; out: readonly Measurement[] } | null = null;

function activeSnapshot(): readonly Measurement[] {
  const all = snapshot();
  const id = getActivePersonId();
  if (memo && memo.source === all && memo.id === id) return memo.out;
  memo = { source: all, id, out: measurementsOf(all, id) };
  return memo.out;
}

/** The active person's readings. */
export function useMeasurements(): readonly Measurement[] {
  return useSyncExternalStore(subscribe, activeSnapshot, activeSnapshot);
}
