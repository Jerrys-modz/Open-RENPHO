import type { Measurement } from '@/domain/measurement';
import { appendMeasurements, groupEntries, latestWithDelta, parse, removeEntry, seriesFor, serialize, withBpContext } from '../measurements';

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

describe('blood-pressure entries', () => {
  it('groups systolic, diastolic and pulse of one reading as a single entry', () => {
    const mk = (type: Measurement['type'], takenAt: number): Measurement => ({ type, value: 1, takenAt, source: 'ihealth-kn550bt' });
    const entries = groupEntries([mk('bp_systolic', 1), mk('bp_diastolic', 1), mk('pulse', 1), mk('bp_systolic', 2)]);
    expect(entries.map((e) => [e.kind, e.measurements.length])).toEqual([
      ['blood-pressure', 1],
      ['blood-pressure', 3],
    ]);
  });
});

describe('withBpContext', () => {
  const cuff = (type: Measurement['type'], value: number, takenAt: number, site?: string): Measurement => ({ type, value, takenAt, source: 'ihealth-kn550bt', site });
  const base = [cuff('bp_systolic', 120, 1), cuff('bp_diastolic', 80, 1), cuff('pulse', 60, 1), cuff('bp_systolic', 130, 2), cuff('bp_arm', 1, 2, 'left')];

  it('replaces one reading\'s arm and position without touching the others', () => {
    const out = withBpContext(base, 'ihealth-kn550bt', 2, { arm: 'right', position: 'sitting', note: null });
    expect(out.filter((x) => x.takenAt === 2 && x.type === 'bp_arm').map((x) => x.site)).toEqual(['right']);
    expect(out.filter((x) => x.takenAt === 2 && x.type === 'bp_position').map((x) => x.site)).toEqual(['sitting']);
    expect(out.filter((x) => x.takenAt === 1)).toEqual(base.filter((x) => x.takenAt === 1));
  });

  it('clears a field when it is set to null', () => {
    const out = withBpContext(base, 'ihealth-kn550bt', 2, { arm: null, position: null, note: null });
    expect(out.some((x) => x.type === 'bp_arm' || x.type === 'bp_position')).toBe(false);
    expect(out.filter((x) => x.type === 'bp_systolic')).toHaveLength(2);
  });

  it('keeps arm and position in the reading\'s history entry', () => {
    const entries = groupEntries(withBpContext(base, 'ihealth-kn550bt', 1, { arm: 'left', position: 'lying', note: null }));
    expect(entries.map((e) => e.kind)).toEqual(['blood-pressure', 'blood-pressure']);
    expect(entries.find((e) => e.takenAt === 1)?.measurements.map((x) => x.type)).toEqual(
      expect.arrayContaining(['bp_systolic', 'bp_arm', 'bp_position']),
    );
  });
});

describe('withBpContext for another person', () => {
  const cuff = (type: Measurement['type'], value: number, takenAt: number, person?: string, site?: string): Measurement => ({ type, value, takenAt, source: 'ihealth-kn550bt', site, person });

  it('marks the new context rows as that person\'s', () => {
    const list = [cuff('bp_systolic', 120, 1, 'p1'), cuff('bp_diastolic', 80, 1, 'p1')];
    const out = withBpContext(list, 'ihealth-kn550bt', 1, { arm: 'left', position: null, note: 'hi' }, 'p1');
    expect(out.filter((x) => x.type === 'bp_arm' || x.type === 'bp_note').map((x) => x.person)).toEqual(['p1', 'p1']);
  });

  it('leaves the primary person\'s rows unmarked, as before', () => {
    const out = withBpContext([], 'ihealth-kn550bt', 1, { arm: 'right', position: null, note: null });
    expect(out[0]).not.toHaveProperty('person');
  });
});
