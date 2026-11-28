import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { DEMO_GOALS, readDemoMode } from '@/demo';
import { NO_GOALS, parseGoals, serializeGoals, type Goals } from '@/domain/goals';

// Goals live in their own small JSON file, on the phone only. They are never synced.
const file = () => new File(Paths.document, 'goals.json');
const demo = readDemoMode() !== null;
let cache: Goals | undefined;
const listeners = new Set<() => void>();

function snapshot(): Goals {
  if (cache === undefined) {
    if (demo) cache = DEMO_GOALS;
    else {
      try {
        const f = file();
        cache = f.exists ? parseGoals(f.textSync()) : NO_GOALS;
      } catch {
        cache = NO_GOALS;
      }
    }
  }
  return cache;
}

export function getGoals(): Goals {
  return snapshot();
}

export function saveGoals(g: Goals): void {
  cache = g;
  if (!demo) {
    try {
      const f = file();
      if (!f.exists) f.create();
      f.writeSync(serializeGoals(g));
    } catch (e) {
      console.warn('[goals] could not save', e);
    }
  }
  listeners.forEach((l) => l());
}

export function useGoals(): Goals {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    snapshot,
    snapshot,
  );
}
