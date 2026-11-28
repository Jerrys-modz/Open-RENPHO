import type { Measurement } from '@/domain/measurement';
import { checkConnection, normalizeServerUrl, postHealthData } from '../sparkyClient';
import { localDate, pendingSparkyItems, toSparkyItem } from '../sparkyMapping';

const T = new Date(2026, 9, 9, 23, 30, 0).getTime(); // 11:30 pm local, so a UTC date would be wrong
const m = (type: Measurement['type'], value: number, extra: Partial<Measurement> = {}): Measurement => ({
  type,
  value,
  takenAt: T,
  source: 't',
  ...extra,
});

describe('toSparkyItem', () => {
  it('uses the local date, not UTC, and keeps the timestamp', () => {
    expect(localDate(T)).toBe('2026-10-09');
    const r = toSparkyItem(m('weight', 107.5), false)!.record;
    expect(r).toMatchObject({ type: 'weight', value: 107.5, date: '2026-10-09' });
    expect(r.timestamp).toBe(new Date(T).toISOString());
  });

  it('maps built-in check-in types', () => {
    const types = (
      [
        ['body_fat', 'body_fat'],
        ['muscle_mass', 'muscle_mass_kg'],
        ['bone_mass', 'bone_mass_kg'],
        ['body_water', 'body_water_percentage'],
        ['bmr', 'bmr'],
      ] as const
    ).map(([t, want]) => [toSparkyItem(m(t, 1), false)?.record.type, want]);
    for (const [got, want] of types) expect(got).toBe(want);
  });

  it('sends waist, hips and neck built in and other sites as custom cm', () => {
    expect(toSparkyItem(m('circumference', 100, { site: 'waist' }), false)?.record).toMatchObject({ type: 'waist', value: 100 });
    expect(toSparkyItem(m('circumference', 100, { site: 'waist' }), false)?.record.unit).toBeUndefined();
    expect(toSparkyItem(m('circumference', 40, { site: 'bicep' }), false)?.record).toMatchObject({ type: 'Bicep', unit: 'cm' });
  });

  it('only sends the extra metrics when asked', () => {
    expect(toSparkyItem(m('protein', 18), false)).toBeNull();
    expect(toSparkyItem(m('protein', 18), true)?.record).toMatchObject({ type: 'Protein', unit: '%' });
    expect(toSparkyItem(m('impedance', 437), true)?.record.unit).toBe('ohm');
  });
});

describe('pendingSparkyItems', () => {
  it('skips sent readings and orders oldest first so the latest of a day wins', () => {
    const a = m('weight', 100, { takenAt: 2000 });
    const b = m('weight', 99, { takenAt: 1000 });
    const sent = m('body_fat', 20, { takenAt: 3000 });
    const keys = new Set([toSparkyItem(sent, false)!.key]);
    expect(pendingSparkyItems([a, sent, b], keys, false).map((i) => i.record.value)).toEqual([99, 100]);
  });
});

describe('normalizeServerUrl', () => {
  it('cleans up what people paste', () => {
    expect(normalizeServerUrl('sparky.example.com')).toBe('https://sparky.example.com');
    expect(normalizeServerUrl(' https://sparky.example.com/ ')).toBe('https://sparky.example.com');
    expect(normalizeServerUrl('https://sparky.example.com/api')).toBe('https://sparky.example.com');
    expect(normalizeServerUrl('https://example.com/sparky/api/')).toBe('https://example.com/sparky');
    expect(normalizeServerUrl('http://192.168.1.5:3000')).toBe('http://192.168.1.5:3000');
  });

  it('rejects empty and non-http input', () => {
    expect(normalizeServerUrl('')).toBeNull();
    expect(normalizeServerUrl('ftp://x.com')).toBeNull();
  });
});

describe('postHealthData', () => {
  const rec = [{ type: 'weight', value: 1, date: '2026-10-09', timestamp: 'x' }];
  const reply = (status: number, body: unknown) =>
    (jest.fn(async () => ({ status, ok: status < 300, json: async () => body })) as unknown) as typeof fetch;

  it('sends a bearer key to /api/health-data', async () => {
    const f = reply(200, { processed: [1], errors: [], skipped: [] });
    await postHealthData('https://s.com', 'KEY', rec, f);
    const [url, init] = (f as unknown as jest.Mock).mock.calls[0];
    expect(url).toBe('https://s.com/api/health-data');
    expect(init.headers.Authorization).toBe('Bearer KEY');
    expect(JSON.parse(init.body)).toEqual(rec);
  });

  it('reads partial failures from the errors array of a 200', async () => {
    const out = await postHealthData('https://s.com', 'K', rec, reply(200, { processed: [1], errors: [{ type: 'bmr', error: 'out of range' }] }));
    expect(out).toEqual({ kind: 'ok', processed: 1, errors: ['bmr: out of range'] });
  });

  it('distinguishes bad key, missing permission, bad body and server trouble', async () => {
    expect((await postHealthData('https://s.com', 'K', rec, reply(401, {}))).kind).toBe('unauthorized');
    expect((await postHealthData('https://s.com', 'K', rec, reply(403, {}))).kind).toBe('forbidden');
    expect(await postHealthData('https://s.com', 'K', rec, reply(400, { error: 'Invalid JSON array format.' }))).toEqual({
      kind: 'rejected',
      message: 'Invalid JSON array format.',
    });
    expect((await postHealthData('https://s.com', 'K', rec, reply(500, { error: 'boom' }))).kind).toBe('failed');
    const down = (jest.fn(async () => {
      throw new Error('Network request failed');
    }) as unknown) as typeof fetch;
    expect(await postHealthData('https://s.com', 'K', rec, down)).toEqual({ kind: 'failed', message: 'Network request failed' });
  });
});

describe('checkConnection', () => {
  const reply = (status: number, body: unknown) =>
    (jest.fn(async () => ({ status, ok: status < 300, json: async () => body })) as unknown) as typeof fetch;

  it('accepts a server that gets past authentication', async () => {
    expect(await checkConnection('https://s.com', 'K', reply(200, { errors: [] }))).toEqual({ ok: true });
    expect(await checkConnection('https://s.com', 'K', reply(400, { error: 'Invalid JSON array format.' }))).toEqual({ ok: true });
  });

  it('explains a bad key, a missing permission and an unreachable server', async () => {
    expect(await checkConnection('https://s.com', 'K', reply(401, {}))).toMatchObject({ ok: false, message: expect.stringContaining('API key') });
    expect(await checkConnection('https://s.com', 'K', reply(403, {}))).toMatchObject({ ok: false, message: expect.stringContaining('health_data_write') });
    expect(await checkConnection('https://s.com', 'K', reply(502, {}))).toMatchObject({ ok: false, message: expect.stringContaining('Could not reach') });
  });
});

describe('blood pressure to SparkyFitness', () => {
  const T0 = Date.UTC(2026, 9, 21, 18, 52);
  const bp = (type: Measurement['type'], value: number, site?: string, takenAt = T0): Measurement => ({ type, value, takenAt, source: 'ihealth-kn550bt', site });
  const reading = (takenAt = T0): Measurement[] => [bp('bp_systolic', 125, undefined, takenAt), bp('bp_diastolic', 64, undefined, takenAt), bp('pulse', 69, undefined, takenAt)];

  it('uses the blood-pressure sync types, with a source, even without extras', () => {
    expect(toSparkyItem(bp('bp_systolic', 125), false)?.record).toMatchObject({
      type: 'blood_pressure_systolic',
      value: 125,
      unit: 'mmHg',
      source: 'keel',
      timestamp: new Date(T0).toISOString(),
    });
    expect(toSparkyItem(bp('bp_diastolic', 64), false)?.record).toMatchObject({ type: 'blood_pressure_diastolic', source: 'keel' });
  });

  it('sends no separate records for pulse, arm, position or the cuff flags', () => {
    for (const m of [bp('pulse', 69), bp('bp_arm', 1, 'left'), bp('bp_position', 1, 'sitting'), bp('irregular_pulse', 1), bp('body_movement', 1)]) {
      expect(toSparkyItem(m, true)).toBeNull();
    }
  });

  it('puts pulse, arm and position on both halves with the same time and source', () => {
    const list = [...reading(), bp('bp_arm', 1, 'left'), bp('bp_position', 1, 'sitting')];
    const items = pendingSparkyItems(list, new Set(), false);
    expect(items.map((i) => i.record.type).sort()).toEqual(['blood_pressure_diastolic', 'blood_pressure_systolic']);
    for (const i of items) {
      expect(i.record).toMatchObject({ pulse_bpm: 69, arm: 'left', body_position: 'sitting', source: 'keel', timestamp: new Date(T0).toISOString() });
    }
  });

  it('sends a note and the reclining position on both halves', () => {
    const list = [...reading(), bp('bp_position', 1, 'reclining'), bp('bp_note', 1, 'After coffee')];
    for (const i of pendingSparkyItems(list, new Set(), false)) {
      expect(i.record).toMatchObject({ body_position: 'reclining', note: 'After coffee' });
    }
    expect(toSparkyItem(bp('bp_note', 1, 'After coffee'), true)).toBeNull();
  });

  it('leaves arm and position out when none was recorded', () => {
    const [i] = pendingSparkyItems(reading(), new Set(), false);
    expect(i.record).toMatchObject({ pulse_bpm: 69 });
    expect(i.record).not.toHaveProperty('arm');
    expect(i.record).not.toHaveProperty('body_position');
  });

  it('keeps each reading\'s context apart and does not resend what was already sent', () => {
    const t1 = T0 + 60_000;
    const list = [...reading(), bp('bp_arm', 1, 'right'), ...reading(t1)];
    const items = pendingSparkyItems(list, new Set(), false);
    expect(items.filter((i) => i.takenAt === T0).every((i) => i.record.arm === 'right')).toBe(true);
    expect(items.filter((i) => i.takenAt === t1).every((i) => i.record.arm === undefined)).toBe(true);
    const sent = new Set(items.filter((i) => i.takenAt === T0).map((i) => i.key));
    expect(pendingSparkyItems(list, sent, false).every((i) => i.takenAt === t1)).toBe(true);
  });
});
