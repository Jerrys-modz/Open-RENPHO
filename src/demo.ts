import { File, Paths } from 'expo-file-system';
import type { WeighIn } from '@/ble/qn/session';
import type { Measurement } from '@/domain/measurement';

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

export const DEMO_TAPE = { cm: 31.5 };

const DAY = 24 * 60 * 60 * 1000;
// A fixed "now" (2026-10-07 07:05 UTC) so screenshots are the same on every run.
const DEMO_NOW = Date.UTC(2026, 9, 7, 7, 5);

/** About six weeks of sample readings: weigh-ins most days, tape measurements weekly. Deterministic. */
export function demoMeasurements(): Measurement[] {
  const out: Measurement[] = [];
  const days = 42;
  for (let i = 0; i < days; i++) {
    if (i % 6 === 4) continue; // a few missed days
    const takenAt = DEMO_NOW - (days - 1 - i) * DAY;
    const w = 80.6 - i * 0.12 + Math.sin(i / 2.5) * 0.35;
    const bf = 23.1 - i * 0.045 + Math.sin(i / 3) * 0.25;
    out.push({ type: 'weight', value: Math.round(w * 100) / 100, takenAt, source: 'qn-scale' });
    out.push({ type: 'body_fat', value: Math.round(bf * 10) / 10, takenAt, source: 'qn-scale' });
  }
  const sites: [string, number, number][] = [
    ['waist', 91.0, -0.7],
    ['hips', 101.2, -0.35],
    ['chest', 104.0, 0.1],
    ['bicep', 33.4, 0.15],
    ['thigh', 58.9, -0.2],
  ];
  for (let k = 0; k < 6; k++) {
    const takenAt = DEMO_NOW - (5 - k) * 7 * DAY + 3600_000;
    for (const [site, base, step] of sites) {
      out.push({
        type: 'circumference',
        value: Math.round((base + step * k) * 10) / 10,
        takenAt,
        source: 'rf-bmf01',
        site,
      });
    }
  }
  return out;
}
