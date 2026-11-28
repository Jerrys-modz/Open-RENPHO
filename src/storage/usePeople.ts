import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { readDemoMode } from '@/demo';
import { DEFAULT_PEOPLE, PRIMARY_PERSON, parsePeople, serializePeople, type People } from '@/domain/people';

// Who uses this phone, and who is active, in a small JSON file. Everyone's data is kept apart by person id.
const file = () => new File(Paths.document, 'people.json');
const demo = readDemoMode() !== null;
let cache: People | undefined;
const listeners = new Set<() => void>();

function snapshot(): People {
  if (cache === undefined) {
    if (demo) cache = DEFAULT_PEOPLE;
    else {
      try {
        const f = file();
        cache = f.exists ? parsePeople(f.textSync()) : DEFAULT_PEOPLE;
      } catch {
        cache = DEFAULT_PEOPLE;
      }
    }
  }
  return cache;
}

export const getPeople = (): People => snapshot();

/** The person whose data every screen is showing and adding to. */
export const getActivePersonId = (): string => snapshot().activeId;

export function savePeople(next: People): void {
  cache = next;
  if (!demo) {
    try {
      const f = file();
      if (!f.exists) f.create();
      f.writeSync(serializePeople(next));
    } catch (e) {
      console.warn('[people] could not save', e);
    }
  }
  listeners.forEach((l) => l());
}

/** For stores that follow the active person: tells them to re-read when it changes. */
export function subscribePeople(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function usePeople(): People {
  return useSyncExternalStore(subscribePeople, snapshot, snapshot);
}

export { PRIMARY_PERSON };
