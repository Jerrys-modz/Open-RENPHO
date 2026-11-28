import type { Measurement } from '../measurement';
import { averageBp, bpContextMeasurements, bpContextOf, bpContextText, bpReadings, classifyBp } from '../bloodPressure';

const DAY = 24 * 60 * 60 * 1000;
const m = (type: Measurement['type'], value: number, takenAt: number, source = 'ihealth-kn550bt'): Measurement => ({
  type,
  value,
  takenAt,
  source,
});
const reading = (t: number, sys: number, dia: number, pulse = 60) => [m('bp_systolic', sys, t), m('bp_diastolic', dia, t), m('pulse', pulse, t)];

describe('classifyBp (ACC/AHA 2017)', () => {
  it.each([
    [119, 79, 'normal'],
    [120, 79, 'elevated'],
    [129, 79, 'elevated'],
    [130, 79, 'stage1'],
    [125, 80, 'stage1'],
    [139, 89, 'stage1'],
    [140, 70, 'stage2'],
    [118, 90, 'stage2'],
    [180, 100, 'stage2'],
    [181, 100, 'crisis'],
    [150, 121, 'crisis'],
  ] as const)('%i/%i is %s', (sys, dia, expected) => {
    expect(classifyBp(sys, dia)).toBe(expected);
  });
});

describe('bpReadings', () => {
  it('assembles readings newest first with their flags', () => {
    const list = [...reading(1000, 120, 80), ...reading(2000, 130, 85), m('irregular_pulse', 1, 2000), m('body_movement', 1, 2000)];
    const rs = bpReadings(list);
    expect(rs.map((r) => r.takenAt)).toEqual([2000, 1000]);
    expect(rs[0]).toMatchObject({ systolic: 130, diastolic: 85, pulse: 60, irregularPulse: true, bodyMovement: true });
    expect(rs[1]).toMatchObject({ irregularPulse: false, bodyMovement: false });
  });

  it('skips half a reading and ignores other measurements', () => {
    expect(bpReadings([m('bp_systolic', 120, 1), m('weight', 80, 1, 'qn-scale')])).toEqual([]);
  });
});

describe('averageBp', () => {
  const rs = bpReadings([
    ...reading(100 * DAY, 120, 80, 60),
    ...reading(95 * DAY, 130, 90, 70),
    ...reading(60 * DAY, 160, 100, 90),
  ]);

  it('averages the window ending at the newest reading', () => {
    expect(averageBp(rs, 7)).toEqual({ systolic: 125, diastolic: 85, pulse: 65, count: 2 });
    expect(averageBp(rs, 90)).toMatchObject({ systolic: 137, diastolic: 90, count: 3 });
  });

  it('is null with no readings', () => {
    expect(averageBp([], 7)).toBeNull();
  });
});

describe('arm and position', () => {
  it('stores one row per field that is set, and none for the rest', () => {
    expect(bpContextMeasurements('s', 5, { arm: 'left', position: null })).toEqual([{ type: 'bp_arm', value: 1, takenAt: 5, source: 's', site: 'left' }]);
    expect(bpContextMeasurements('s', 5, { arm: null, position: null })).toEqual([]);
    expect(bpContextMeasurements('s', 5, { arm: 'right', position: 'lying' }).map((m) => [m.type, m.site])).toEqual([
      ['bp_arm', 'right'],
      ['bp_position', 'lying'],
    ]);
  });

  it('reads them back onto the reading', () => {
    const list = [...reading(1000, 120, 80), ...bpContextMeasurements('ihealth-kn550bt', 1000, { arm: 'right', position: 'sitting' }), ...reading(2000, 130, 85)];
    const [newer, older] = bpReadings(list);
    expect(older).toMatchObject({ arm: 'right', position: 'sitting' });
    expect(newer).toMatchObject({ arm: null, position: null });
  });

  it('ignores a context row without a valid site and describes what is set', () => {
    expect(bpContextOf([m('bp_arm', 1, 1)])).toEqual({ arm: null, position: null });
    expect(bpContextText({ arm: 'left', position: 'sitting' })).toBe('Left arm · sitting');
    expect(bpContextText({ arm: null, position: 'lying' })).toBe('lying down');
    expect(bpContextText({ arm: null, position: null })).toBeNull();
  });
});
