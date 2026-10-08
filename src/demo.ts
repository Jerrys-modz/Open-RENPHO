import { File, Paths } from 'expo-file-system';
import type { WeighIn } from '@/ble/qn/session';
import { deriveBodyMetrics } from '@/ble/qn/bodyMetrics';
import type { Measurement } from '@/domain/measurement';
import type { UserProfile } from '@/domain/profile';

export type DemoScreen = 'home' | 'scale' | 'tape' | 'profile';

const SCREENS: readonly DemoScreen[] = ['home', 'scale', 'tape', 'profile'];

export const DEMO_PROFILE: UserProfile = { sex: 'male', birthDate: '1983-03-14', heightCm: 178, athlete: false };

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
    const weight = Math.round(w * 100) / 100;
    const bodyFat = Math.round(bf * 10) / 10;
    out.push({ type: 'weight', value: weight, takenAt, source: 'qn-scale' });
    out.push({ type: 'body_fat', value: bodyFat, takenAt, source: 'qn-scale' });
    const d = deriveBodyMetrics(weight, DEMO_PROFILE.heightCm / 100, 0, bodyFat);
    for (const [type, value] of [
      ['bmi', d.bmi],
      ['body_water', d.bodyWater],
      ['skeletal_muscle', d.skeletalMuscle],
      ['muscle_mass', d.muscleMass],
      ['fat_free_mass', d.fatFreeMass],
      ['bone_mass', d.boneMass],
      ['protein', d.protein],
      ['bmr', d.bmr],
    ] as const) {
      out.push({ type, value, takenAt, source: 'qn-scale' });
    }
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
