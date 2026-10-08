import { File, Paths } from 'expo-file-system';
import type { WeighIn } from '@/ble/qn/session';

export type DemoScreen = 'home' | 'scale' | 'tape';

const SCREENS: readonly DemoScreen[] = ['home', 'scale', 'tape'];

/** Pure parser for the text of the `demo-mode` file. Returns null for anything unrecognised. */
export function parseDemoMode(text: string): DemoScreen | null {
  const t = text.trim();
  return (SCREENS as readonly string[]).includes(t) ? (t as DemoScreen) : null;
}

/**
 * CI screenshots: a `demo-mode` file in the app's documents folder fills the screens with
 * sample values (a simulator has no Bluetooth). Its text picks the screen. Cosmetic only:
 * nothing is stored or sent. Returns null when the file is absent.
 */
export function readDemoMode(): DemoScreen | null {
  try {
    const f = new File(Paths.document, 'demo-mode');
    return f.exists ? parseDemoMode(f.textSync()) : null;
  } catch {
    return null;
  }
}

export const DEMO_WEIGH_IN: WeighIn = {
  flavor: 'extended',
  weightKg: 74.95,
  bodyFat: 21.0,
  resistance1: 505,
  resistance2: 503,
};

export const DEMO_TAPE = {
  cm: 31.5,
  saved: [
    { at: 3, cm: 98.6, site: 'hips' },
    { at: 2, cm: 84.2, site: 'waist' },
    { at: 1, cm: 31.5, site: 'thigh' },
  ],
};
