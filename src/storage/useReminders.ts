import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { readDemoMode } from '@/demo';
import { DEFAULT_REMINDERS, parseReminders, serializeReminders, type Reminders } from '@/domain/reminders';

// Reminder times live in their own small JSON file on the phone.
const file = () => new File(Paths.document, 'reminders.json');
const demo = readDemoMode() !== null;
let cache: Reminders | undefined;
const listeners = new Set<() => void>();

function snapshot(): Reminders {
  if (cache === undefined) {
    if (demo) cache = DEFAULT_REMINDERS;
    else {
      try {
        const f = file();
        cache = f.exists ? parseReminders(f.textSync()) : DEFAULT_REMINDERS;
      } catch {
        cache = DEFAULT_REMINDERS;
      }
    }
  }
  return cache;
}

export function getReminders(): Reminders {
  return snapshot();
}

export function saveReminders(r: Reminders): void {
  cache = r;
  if (!demo) {
    try {
      const f = file();
      if (!f.exists) f.create();
      f.writeSync(serializeReminders(r));
    } catch (e) {
      console.warn('[reminders] could not save', e);
    }
  }
  listeners.forEach((l) => l());
}

export function useReminders(): Reminders {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    snapshot,
    snapshot,
  );
}
