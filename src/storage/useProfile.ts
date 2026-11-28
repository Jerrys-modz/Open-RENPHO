import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { DEMO_PROFILE, readDemoMode } from '@/demo';
import { personFile, PRIMARY_PERSON } from '@/domain/people';
import { parseProfile, serializeProfile, type UserProfile } from '@/domain/profile';
import { getActivePersonId, subscribePeople } from './usePeople';

// One profile per person, each in its own JSON file (the primary person's keeps the original name).
const file = (personId: string) => new File(Paths.document, personFile('profile', personId));
const demo = readDemoMode() !== null;
const cache = new Map<string, UserProfile | null>();
const listeners = new Set<() => void>();

export function getProfileFor(personId: string): UserProfile | null {
  if (!cache.has(personId)) {
    if (demo) cache.set(personId, personId === PRIMARY_PERSON ? DEMO_PROFILE : null);
    else {
      try {
        const f = file(personId);
        cache.set(personId, f.exists ? parseProfile(f.textSync()) : null);
      } catch {
        cache.set(personId, null);
      }
    }
  }
  return cache.get(personId) ?? null;
}

/** The active person's profile. */
export function getProfile(): UserProfile | null {
  return getProfileFor(getActivePersonId());
}

export function saveProfile(p: UserProfile): void {
  const id = getActivePersonId();
  cache.set(id, p);
  if (!demo) {
    try {
      const f = file(id);
      if (!f.exists) f.create();
      f.writeSync(serializeProfile(p));
    } catch (e) {
      console.warn('[profile] could not save', e);
    }
  }
  listeners.forEach((l) => l());
}

/** Forgets one person's profile (when that person is removed). */
export function deleteProfileFor(personId: string): void {
  cache.delete(personId);
  if (!demo) {
    try {
      const f = file(personId);
      if (f.exists) f.delete();
    } catch (e) {
      console.warn('[profile] could not delete', e);
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

export function useProfile(): UserProfile | null {
  return useSyncExternalStore(subscribe, getProfile, getProfile);
}
