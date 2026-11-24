import { measurementsToCsv } from '../csv';

describe('measurementsToCsv', () => {
  it('writes a header, oldest first, in storage units', () => {
    const csv = measurementsToCsv([
      { type: 'weight', value: 80.5, takenAt: Date.UTC(2026, 9, 8, 7), source: 'qn-scale' },
      { type: 'bp_systolic', value: 125, takenAt: Date.UTC(2026, 9, 7, 7), source: 'ihealth-kn550bt' },
      { type: 'circumference', value: 91, takenAt: Date.UTC(2026, 9, 9), source: 'rf-bmf01', site: 'waist' },
    ]);
    expect(csv.split('\n')).toEqual([
      'time_utc,type,site,value,unit,source',
      '2026-10-07T07:00:00.000Z,bp_systolic,,125,mmHg,ihealth-kn550bt',
      '2026-10-08T07:00:00.000Z,weight,,80.5,kg,qn-scale',
      '2026-10-09T00:00:00.000Z,circumference,waist,91,cm,rf-bmf01',
      '',
    ]);
  });

  it('quotes cells that contain commas or quotes', () => {
    const csv = measurementsToCsv([{ type: 'weight', value: 1, takenAt: 0, source: 'a,"b"' }]);
    expect(csv).toContain('"a,""b"""');
  });

  it('is just the header when empty', () => {
    expect(measurementsToCsv([])).toBe('time_utc,type,site,value,unit,source\n');
  });
});
