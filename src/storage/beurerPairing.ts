import { File, Paths } from 'expo-file-system';
import type { BeurerPairing } from '@/ble/beurer/session';

// The user slot and 4-digit code we registered on the Beurer scale. Stays on this phone; losing it
// means registering a new slot (the scale has 8).
const file = () => new File(Paths.document, 'beurer-pairing.json');

export function loadBeurerPairing(): BeurerPairing | null {
  try {
    const f = file();
    if (!f.exists) return null;
    const v = JSON.parse(f.textSync()) as Partial<BeurerPairing>;
    return Number.isInteger(v.userIndex) && Number.isInteger(v.consentCode)
      ? { userIndex: v.userIndex as number, consentCode: v.consentCode as number, ...(v.linked === true ? { linked: true } : {}) }
      : null;
  } catch {
    return null;
  }
}

export function saveBeurerPairing(p: BeurerPairing): void {
  try {
    const f = file();
    if (!f.exists) f.create();
    f.write(JSON.stringify({ version: 1, ...p }));
  } catch (e) {
    console.warn('[beurer] could not save pairing', e);
  }
}

export function clearBeurerPairing(): void {
  try {
    const f = file();
    if (f.exists) f.delete();
  } catch (e) {
    console.warn('[beurer] could not clear pairing', e);
  }
}
