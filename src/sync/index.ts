import { getMeasurements } from '@/storage/useMeasurements';
import { getSyncState, markAppleHealthSynced } from '@/storage/useSyncState';
import { writeAppleHealthBloodPressure, writeAppleHealthSamples } from './appleHealth';
import { pendingBloodPressure, pendingSamples } from './appleHealthMapping';

export interface SyncResult {
  written: number;
  failed: number;
}

let running: Promise<SyncResult> | null = null;

/**
 * Sends anything new to Apple Health, if the user has it on. Safe to call after every save: calls
 * overlap into one run, and readings already sent are skipped.
 */
export function syncAppleHealth(): Promise<SyncResult> {
  if (running) return running;
  const state = getSyncState().appleHealth;
  if (!state.enabled) return Promise.resolve({ written: 0, failed: 0 });
  running = (async () => {
    try {
      const synced = new Set(state.synced);
      const todo = pendingSamples(getMeasurements(), synced);
      const bp = pendingBloodPressure(getMeasurements(), synced);
      if (todo.length === 0 && bp.length === 0) return { written: 0, failed: 0 };
      const a = todo.length ? await writeAppleHealthSamples(todo) : { written: [], failed: 0 };
      const b = bp.length ? await writeAppleHealthBloodPressure(bp) : { written: [], failed: 0 };
      const written = [...a.written, ...b.written];
      if (written.length > 0) markAppleHealthSynced(written, Date.now());
      return { written: written.length, failed: a.failed + b.failed };
    } catch (e) {
      console.warn('[sync] Apple Health failed', e);
      return { written: 0, failed: 1 };
    } finally {
      running = null;
    }
  })();
  return running;
}
