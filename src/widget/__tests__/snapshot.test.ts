import type { Measurement } from '@/domain/measurement';
import { EMPTY_WIDGET, widgetSnapshot } from '../snapshot';

const at = (d: number) => new Date(2026, 10, d, 8).getTime();
const m = (type: Measurement['type'], value: number, takenAt: number, source = 's'): Measurement => ({ type, value, takenAt, source });

describe('widgetSnapshot', () => {
  it('shows placeholders with no data', () => {
    expect(widgetSnapshot([], 'metric', 'mmHg')).toEqual(EMPTY_WIDGET);
  });

  it('uses the newest weight in the display units', () => {
    const list = [m('weight', 80, at(1)), m('weight', 75, at(2))];
    expect(widgetSnapshot(list, 'metric', 'mmHg')).toMatchObject({ weight: '75.0', weightUnit: 'kg' });
    expect(widgetSnapshot(list, 'imperial', 'mmHg')).toMatchObject({ weight: '165.3', weightUnit: 'lb' });
  });

  it('shows the newest blood-pressure reading with its category, in mmHg or kPa', () => {
    const list = [
      m('bp_systolic', 118, at(1)), m('bp_diastolic', 76, at(1)),
      m('bp_systolic', 135, at(3)), m('bp_diastolic', 85, at(3)),
    ];
    const mm = widgetSnapshot(list, 'metric', 'mmHg');
    expect(mm).toMatchObject({ bp: '135/85', bpUnit: 'mmHg', bpCategory: 'High, stage 1' });
    expect(mm.bpColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(widgetSnapshot(list, 'metric', 'kPa')).toMatchObject({ bp: '18.0/11.3', bpUnit: 'kPa' });
  });

  it('carries the person name through', () => {
    expect(widgetSnapshot([], 'metric', 'mmHg', 'Alex').person).toBe('Alex');
  });

  it('is only strings, so it can cross into the widget unchanged', () => {
    const s = widgetSnapshot([m('weight', 80, at(1))], 'metric', 'mmHg');
    for (const v of Object.values(s)) expect(typeof v).toBe('string');
  });
});
