import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { readDemoMode } from '@/demo';

/** What each sync target has already been sent, so nothing is written twice. */
export interface Target {
  enabled: boolean;
  synced: string[];
  lastSyncAt: number | null;
}

export interface SparkyTarget extends Target {
  /** Normalised, e.g. https://sparky.example.com. The API key lives in the keychain, not here. */
  serverUrl: string;
  /** Also send BMI, fat-free mass, skeletal muscle, protein and impedance as custom measurements. */
  includeExtras: boolean;
  /** What the server said about the last sync (rejected records, an auth problem), if anything. */
  lastProblem: string | null;
}

export interface SyncState {
  appleHealth: Target;
  sparky: SparkyTarget;
}

const EMPTY_TARGET: Target = { enabled: false, synced: [], lastSyncAt: null };
const EMPTY: SyncState = {
  appleHealth: EMPTY_TARGET,
  sparky: { ...EMPTY_TARGET, serverUrl: '', includeExtras: false, lastProblem: null },
};

function parseTarget(a: Partial<Target> | undefined): Target {
  return {
    enabled: a?.enabled === true,
    synced: Array.isArray(a?.synced) ? a.synced.filter((k): k is string => typeof k === 'string') : [],
    lastSyncAt: typeof a?.lastSyncAt === 'number' ? a.lastSyncAt : null,
  };
}
const file = () => new File(Paths.document, 'sync.json');
const demo = readDemoMode() !== null;
let cache: SyncState | null = null;
const listeners = new Set<() => void>();

export function parseSyncState(text: string): SyncState {
  try {
    const data = JSON.parse(text) as { appleHealth?: Partial<Target>; sparky?: Partial<SparkyTarget> };
    const sp = data.sparky;
    return {
      appleHealth: parseTarget(data.appleHealth),
      sparky: {
        ...parseTarget(sp),
        serverUrl: typeof sp?.serverUrl === 'string' ? sp.serverUrl : '',
        includeExtras: sp?.includeExtras === true,
        lastProblem: typeof sp?.lastProblem === 'string' ? sp.lastProblem : null,
      },
    };
  } catch {
    return EMPTY;
  }
}

function snapshot(): SyncState {
  if (cache === null) {
    cache = EMPTY;
    if (!demo) {
      try {
        const f = file();
        if (f.exists) cache = parseSyncState(f.textSync());
      } catch {
        // start empty
      }
    }
  }
  return cache;
}

function commit(next: SyncState): void {
  cache = next;
  if (!demo) {
    try {
      const f = file();
      if (!f.exists) f.create();
      f.write(JSON.stringify({ version: 1, ...next }));
    } catch (e) {
      console.warn('[sync] could not save state', e);
    }
  }
  listeners.forEach((l) => l());
}

export const getSyncState = (): SyncState => snapshot();

export function setAppleHealthEnabled(enabled: boolean): void {
  const s = snapshot();
  commit({ ...s, appleHealth: { ...s.appleHealth, enabled } });
}

export function markAppleHealthSynced(keys: readonly string[], at: number): void {
  const s = snapshot();
  const a = s.appleHealth;
  commit({ ...s, appleHealth: { ...a, synced: [...a.synced, ...keys], lastSyncAt: at } });
}

export function updateSparky(patch: Partial<SparkyTarget>): void {
  const s = snapshot();
  commit({ ...s, sparky: { ...s.sparky, ...patch } });
}

export function markSparkySynced(keys: readonly string[], at: number, problem: string | null): void {
  const s = snapshot();
  commit({ ...s, sparky: { ...s.sparky, synced: [...s.sparky.synced, ...keys], lastSyncAt: at, lastProblem: problem } });
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    snapshot,
    snapshot,
  );
}
