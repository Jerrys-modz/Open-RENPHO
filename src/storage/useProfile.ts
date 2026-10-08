import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { DEMO_PROFILE, readDemoMode } from '@/demo';
import { parseProfile, serializeProfile, type UserProfile } from '@/domain/profile';

// One shared copy of the profile, in a JSON file next to the measurements.
const file = () => new File(Paths.document, 'profile.json');
const demo = readDemoMode() !== null;
let cache: UserProfile | null | undefined;
const listeners = new Set<() => void>();

function snapshot(): UserProfile | null {
  if (cache === undefined) {
    if (demo) cache = DEMO_PROFILE;
    else {
      try {
        const f = file();
        cache = f.exists ? parseProfile(f.textSync()) : null;
      } catch {
        cache = null;
      }
    }
  }
  return cache;
}

export function getProfile(): UserProfile | null {
  return snapshot();
}

export function saveProfile(p: UserProfile): void {
  cache = p;
  if (!demo) {
    try {
      const f = file();
      if (!f.exists) f.create();
      f.write(serializeProfile(p));
    } catch (e) {
      console.warn('[profile] could not save', e);
    }
  }
  listeners.forEach((l) => l());
}

export function useProfile(): UserProfile | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    snapshot,
    snapshot,
  );
}
