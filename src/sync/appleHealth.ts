/**
 * Apple Health writes through @kingstinct/react-native-healthkit. Imported lazily so nothing native
 * loads until the user turns this on, and so tests and non-iOS builds never touch it.
 */
import { Platform } from 'react-native';
import { HEALTH_WRITE_TYPES, type HealthSample } from './appleHealthMapping';

const load = () => import('@kingstinct/react-native-healthkit');

export async function isAppleHealthAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await (await load()).isHealthDataAvailable();
  } catch {
    return false;
  }
}

/** Shows the Health permission sheet. We only write, never read. Returns false if the request itself failed. */
export async function requestAppleHealthAccess(): Promise<boolean> {
  try {
    return await (await load()).requestAuthorization({ toShare: HEALTH_WRITE_TYPES });
  } catch (e) {
    console.warn('[health] authorization failed', e);
    return false;
  }
}

export interface WriteResult {
  written: string[];
  failed: number;
}

/** Writes each sample on its own so one rejection (e.g. a type the user denied) does not block the rest. */
export async function writeAppleHealthSamples(samples: readonly HealthSample[]): Promise<WriteResult> {
  const hk = await load();
  const written: string[] = [];
  let failed = 0;
  for (const s of samples) {
    try {
      const d = new Date(s.date);
      await hk.saveQuantitySample(s.identifier, s.unit as never, s.value, d, d);
      written.push(s.key);
    } catch (e) {
      failed += 1;
      console.warn('[health] could not save', s.identifier, e);
    }
  }
  return { written, failed };
}
