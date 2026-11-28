import type { BpReading } from '@/domain/bloodPressure';
import { buildBpReportHtml } from '../bpReport';

const at = (h: number, d = 1) => new Date(2026, 10, d, h, 0, 0).getTime();
const r = (takenAt: number, systolic: number, diastolic: number, extra: Partial<BpReading> = {}): BpReading => ({
  takenAt,
  systolic,
  diastolic,
  pulse: 70,
  irregularPulse: false,
  bodyMovement: false,
  arm: null,
  position: null,
  note: null,
  ...extra,
});
const opts = { pressure: 'mmHg' as const, generatedAt: at(12, 28), rangeLabel: 'Last 30 days' };

describe('buildBpReportHtml', () => {
  const readings = [r(at(8, 1), 120, 80), r(at(9, 2), 130, 90, { arm: 'left', position: 'sitting' }), r(at(19, 3), 140, 70, { irregularPulse: true })];
  const html = buildBpReportHtml(readings, opts);

  it('summarises the readings', () => {
    expect(html).toContain('Blood pressure report');
    expect(html).toContain('Last 30 days');
    expect(html).toContain('130/80, pulse 70 (3)'); // overall average
    expect(html).toContain('125/85, pulse 70 (2)'); // before noon: 120/80 and 130/90
    expect(html).toContain('140/70, pulse 70 (1)'); // from noon on
    expect(html).toContain('Left arm');
    expect(html).toContain('Sitting');
    expect(html).toContain('Irregular pulse flagged');
    expect(html).toContain('not a diagnosis');
  });

  it('lists every reading oldest first', () => {
    const table = html.slice(html.indexOf('<h2>Readings</h2>'));
    expect(table.indexOf('120/80')).toBeLessThan(table.indexOf('130/90'));
    expect(table.indexOf('130/90')).toBeLessThan(table.indexOf('140/70'));
  });

  it('shows kPa when that is the display unit', () => {
    const k = buildBpReportHtml([r(at(8), 120, 80)], { ...opts, pressure: 'kPa' });
    expect(k).toContain('16.0/10.7');
    expect(k).toContain('Pressures in kPa');
  });

  it('escapes anything the user typed', () => {
    const evil = buildBpReportHtml([r(at(8), 120, 80, { note: '<script>alert("x")</script> & more' })], opts);
    expect(evil).not.toContain('<script>');
    expect(evil).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; more');
  });

  it('handles no readings', () => {
    const empty = buildBpReportHtml([], opts);
    expect(empty).toContain('No readings in this period.');
    expect(empty).not.toContain('<h2>Summary</h2>');
  });
});
