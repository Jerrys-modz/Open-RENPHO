import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { DEMO_GOALS, readDemoMode } from '@/demo';
import { NO_GOALS, parseGoals, serializeGoals, type Goals } from '@/domain/goals';
import { personFile, PRIMARY_PERSON } from '@/domain/people';
import { getActivePersonId, subscribePeople } from './usePeople';

// Goals are per person, each in their own small JSON file on the phone only. They are never synced.
const file = (personId: string) => new File(Paths.document, personFile('goals', personId));
const demo = readDemoMode() !== null;
const cache = new Map<string, Goals>();
const listeners = new Set<() => void>();

function goalsFor(personId: string): Goals {
  const have = cache.get(personId);
  if (have) return have;
  let g: Goals = NO_GOALS;
  if (demo) g = personId === PRIMARY_PERSON ? DEMO_GOALS : NO_GOALS;
  else {
    try {
      const f = file(personId);
      g = f.exists ? parseGoals(f.textSync()) : NO_GOALS;
    } catch {
      g = NO_GOALS;
    }
  }
  cache.set(personId, g);
  return g;
}

/** The active person's goals. */
export function getGoals(): Goals {
  return goalsFor(getActivePersonId());
}

export function saveGoals(g: Goals): void {
  const id = getActivePersonId();
  cache.set(id, g);
  if (!demo) {
    try {
      const f = file(id);
      if (!f.exists) f.create();
      f.writeSync(serializeGoals(g));
    } catch (e) {
      console.warn('[goals] could not save', e);
    }
  }
  listeners.forEach((l) => l());
}

/** Forgets one person's goals (when that person is removed). */
export function deleteGoalsFor(personId: string): void {
  cache.delete(personId);
  if (!demo) {
    try {
      const f = file(personId);
      if (f.exists) f.delete();
    } catch (e) {
      console.warn('[goals] could not delete', e);
    }
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const off = subscribePeople(cb);
  return () => {
    listeners.delete(cb);
    off();
  };
}

export function useGoals(): Goals {
  return useSyncExternalStore(subscribe, getGoals, getGoals);
}
