import type { Measurement } from '@/domain/measurement';
import { appendMeasurements, groupEntries, latestWithDelta, parse, removeEntry, seriesFor, serialize } from '../measurements';

const m = (type: Measurement['type'], value: number, takenAt: number, site?: string): Measurement => ({
  type,
  value,
  takenAt,
  source: 't',
  site,
});

const LIST: Measurement[] = [
  m('weight', 80, 3),
  m('weight', 81, 1),
  m('weight', 79.5, 2),
  m('circumference', 90, 1, 'waist'),
  m('circumference', 100, 1, 'hips'),
  m('circumference', 88, 5, 'waist'),
];

describe('seriesFor', () => {
  it('is sorted oldest first and filtered by type', () => {
    expect(seriesFor(LIST, { type: 'weight' })).toEqual([
      { t: 1, v: 81 },
      { t: 2, v: 79.5 },
      { t: 3, v: 80 },
    ]);
  });
  it('filters circumference by site', () => {
    expect(seriesFor(LIST, { type: 'circumference', site: 'waist' }).map((p) => p.v)).toEqual([90, 88]);
  });
});

describe('latestWithDelta', () => {
  it('returns the newest value and the change since the previous one', () => {
    const l = latestWithDelta(LIST, { type: 'weight' });
    expect(l?.point).toEqual({ t: 3, v: 80 });
    expect(l?.delta).toBeCloseTo(0.5, 5);
  });
  it('has no delta for a single reading and null for none', () => {
    expect(latestWithDelta(LIST, { type: 'circumference', site: 'hips' })?.delta).toBeNull();
    expect(latestWithDelta(LIST, { type: 'body_fat' })).toBeNull();
  });
});

describe('appendMeasurements', () => {
  it('ignores duplicates (same source, type, site, time)', () => {
    const out = appendMeasurements(LIST, [m('weight', 80, 3), m('weight', 82, 9)]);
    expect(out).toHaveLength(LIST.length + 1);
  });
  it('treats different sites at the same time as different readings', () => {
    const out = appendMeasurements([], [m('circumference', 1, 1, 'waist'), m('circumference', 2, 1, 'hips')]);
    expect(out).toHaveLength(2);
  });
});

describe('serialize / parse', () => {
  it('round-trips', () => {
    expect(parse(serialize(LIST))).toEqual(LIST);
  });
  it('drops invalid entries and survives garbage', () => {
    const text = JSON.stringify({ measurements: [m('weight', 1, 1), { type: 'weight', value: 'x' }, null] });
    expect(parse(text)).toHaveLength(1);
    expect(parse('not json')).toEqual([]);
    expect(parse('{}')).toEqual([]);
  });
});

describe('groupEntries and removeEntry', () => {
  const mk = (type: Measurement['type'], takenAt: number, extra: Partial<Measurement> = {}): Measurement => ({
    type,
    value: 1,
    takenAt,
    source: 'qn-scale',
    ...extra,
  });
  const list = [
    mk('weight', 100),
    mk('body_fat', 100),
    mk('weight', 200),
    mk('circumference', 150, { source: 'rf-bmf01', site: 'waist' }),
    mk('circumference', 150, { source: 'rf-bmf01', site: 'hips' }),
  ];

  it('groups a weigh-in and keeps tape readings separate, newest first', () => {
    const entries = groupEntries(list);
    expect(entries.map((e) => [e.kind, e.measurements.length])).toEqual([
      ['weigh-in', 1],
      ['tape', 1],
      ['tape', 1],
      ['weigh-in', 2],
    ]);
    expect(entries[0].takenAt).toBe(200);
  });

  it('removes only the chosen weigh-in', () => {
    const entry = groupEntries(list).find((e) => e.takenAt === 100)!;
    const rest = removeEntry(list, entry);
    expect(rest).toHaveLength(3);
    expect(rest.some((m) => m.takenAt === 100)).toBe(false);
  });
});
