import { getMeasurements } from '@/storage/useMeasurements';
import { getSyncState, markAppleHealthSynced } from '@/storage/useSyncState';
import { writeAppleHealthSamples } from './appleHealth';
import { pendingSamples } from './appleHealthMapping';

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
      const todo = pendingSamples(getMeasurements(), new Set(state.synced));
      if (todo.length === 0) return { written: 0, failed: 0 };
      const { written, failed } = await writeAppleHealthSamples(todo);
      if (written.length > 0) markAppleHealthSynced(written, Date.now());
      return { written: written.length, failed };
    } catch (e) {
      console.warn('[sync] Apple Health failed', e);
      return { written: 0, failed: 1 };
    } finally {
      running = null;
    }
  })();
  return running;
}
