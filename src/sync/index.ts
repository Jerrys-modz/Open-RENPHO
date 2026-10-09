import { getMeasurements } from '@/storage/useMeasurements';
import { loadSparkyKey } from '@/storage/sparkyKey';
import { getSyncState, markAppleHealthSynced, markSparkySynced, updateSparky } from '@/storage/useSyncState';
import { writeAppleHealthSamples } from './appleHealth';
import { pendingSamples } from './appleHealthMapping';
import { postHealthData } from './sparkyClient';
import { pendingSparkyItems } from './sparkyMapping';

export interface SyncResult {
  written: number;
  failed: number;
  /** Something the user should read, e.g. the server rejected a record. */
  problem?: string;
}

/** Records per request; keeps each POST small and a failed one cheap to retry. */
const SPARKY_BATCH = 100;

// One run per target at a time: calls made while one is in flight join it.
const running: Record<'appleHealth' | 'sparky', Promise<SyncResult> | null> = { appleHealth: null, sparky: null };

function once(target: 'appleHealth' | 'sparky', run: () => Promise<SyncResult>): Promise<SyncResult> {
  const current = running[target];
  if (current) return current;
  const p = run()
    .catch((e): SyncResult => {
      console.warn(`[sync] ${target} failed`, e);
      return { written: 0, failed: 1, problem: e instanceof Error ? e.message : String(e) };
    })
    .finally(() => {
      running[target] = null;
    });
  running[target] = p;
  return p;
}

/** Sends anything new to Apple Health, if the user has it on. Readings already sent are skipped. */
export function syncAppleHealth(): Promise<SyncResult> {
  if (!getSyncState().appleHealth.enabled) return Promise.resolve({ written: 0, failed: 0 });
  return once('appleHealth', async () => {
    const todo = pendingSamples(getMeasurements(), new Set(getSyncState().appleHealth.synced));
    if (todo.length === 0) return { written: 0, failed: 0 };
    const { written, failed } = await writeAppleHealthSamples(todo);
    if (written.length > 0) markAppleHealthSynced(written, Date.now());
    return { written: written.length, failed };
  });
}

const AUTH_PROBLEM = 'SparkyFitness did not accept the API key. Check it and that it has the health_data_write permission.';

/**
 * Sends anything new to SparkyFitness, if configured. A batch counts as sent once the server
 * answers 200: it saves every record it accepts and lists the rest in `errors`, which we show
 * instead of retrying forever. Network, auth and server errors leave the batch unsent for next time.
 */
export function syncSparky(): Promise<SyncResult> {
  const first = getSyncState().sparky;
  if (!first.enabled || !first.serverUrl) return Promise.resolve({ written: 0, failed: 0 });
  return once('sparky', async () => {
    const state = getSyncState().sparky;
    const apiKey = await loadSparkyKey();
    if (!apiKey) return { written: 0, failed: 1, problem: 'No SparkyFitness API key is saved.' };

    const todo = pendingSparkyItems(getMeasurements(), new Set(state.synced), state.includeExtras);
    let written = 0;
    let failed = 0;
    let problem: string | null = null;

    for (let i = 0; i < todo.length; i += SPARKY_BATCH) {
      const batch = todo.slice(i, i + SPARKY_BATCH);
      const out = await postHealthData(state.serverUrl, apiKey, batch.map((b) => b.record));
      if (out.kind === 'ok') {
        written += batch.length - out.errors.length;
        failed += out.errors.length;
        if (out.errors.length > 0) problem = `SparkyFitness rejected ${out.errors.length}: ${out.errors.slice(0, 2).join('; ')}`;
        markSparkySynced(batch.map((b) => b.key), Date.now(), problem);
        continue;
      }
      failed += batch.length;
      problem =
        out.kind === 'unauthorized' || out.kind === 'forbidden'
          ? AUTH_PROBLEM
          : out.message;
      break; // the next batches would fail the same way
    }
    if (problem !== null) updateSparky({ lastProblem: problem });
    return { written, failed, problem: problem ?? undefined };
  });
}

/** After a save: every target the user has turned on. */
export async function syncAll(): Promise<void> {
  await Promise.all([syncAppleHealth(), syncSparky()]);
}
