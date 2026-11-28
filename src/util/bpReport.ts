import {
  BP_ARM_LABEL,
  BP_CATEGORY_LABEL,
  BP_POSITION_LABEL,
  averageBp,
  averageByPartOfDay,
  bpStats,
  classifyBp,
  type BpAverage,
  type BpCategory,
  type BpReading,
} from '@/domain/bloodPressure';
import { formatDateTime, formatShortDate } from './format';
import { formatForDisplay, type PressureUnit } from './units';

const BP_DEF = { unit: 'mmHg', digits: 0 };

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export interface BpReportOptions {
  pressure: PressureUnit;
  /** Unix ms, printed in the footer. */
  generatedAt: number;
  /** Shown under the title, for example "Last 30 days". */
  rangeLabel: string;
}

/**
 * A printable summary of blood-pressure readings for a doctor, as a self-contained HTML page (turned into a
 * PDF on the phone). Everything user-entered is escaped. Plain styling on purpose: tables and basic CSS only.
 */
export function buildBpReportHtml(readings: readonly BpReading[], o: BpReportOptions): string {
  const rows = [...readings].sort((a, b) => a.takenAt - b.takenAt);
  const fmt = (v: number) => formatForDisplay(BP_DEF, v, 'metric', o.pressure).text;
  const pair = (s: number, d: number) => `${fmt(s)}/${fmt(d)}`;
  const avg = (a: BpAverage | null) => (a ? `${pair(a.systolic, a.diastolic)}${a.pulse !== null ? `, pulse ${a.pulse}` : ''} (${a.count})` : 'none');

  const stats = bpStats(rows);
  const overall = averageBp(rows, Infinity);
  const parts = averageByPartOfDay(rows, Infinity);
  const range = rows.length ? `${formatShortDate(rows[0].takenAt)} to ${formatShortDate(rows[rows.length - 1].takenAt)}` : '';

  const summary = stats
    ? [
        ['Readings', String(stats.count)],
        ['Average', avg(overall)],
        ['Average before noon', avg(parts.morning)],
        ['Average from noon on', avg(parts.evening)],
        ['Highest', `${pair(stats.highest.systolic, stats.highest.diastolic)} on ${formatShortDate(stats.highest.takenAt)}`],
        ['Lowest', `${pair(stats.lowest.systolic, stats.lowest.diastolic)} on ${formatShortDate(stats.lowest.takenAt)}`],
        ...(Object.keys(BP_CATEGORY_LABEL) as BpCategory[])
          .filter((c) => stats.categories[c] > 0)
          .map((c) => [BP_CATEGORY_LABEL[c], `${stats.categories[c]} reading${stats.categories[c] === 1 ? '' : 's'}`]),
      ]
    : [];

  const noteOf = (r: BpReading) =>
    [r.note, r.irregularPulse ? 'Irregular pulse flagged' : null, r.bodyMovement ? 'Movement during reading' : null]
      .filter((x): x is string => !!x)
      .join('; ');

  const tr = (cells: string[], tag = 'td') => `<tr>${cells.map((c) => `<${tag}>${escapeHtml(c)}</${tag}>`).join('')}</tr>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Blood pressure report</title>
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 11px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  h2 { font-size: 13px; margin: 18px 0 6px; }
  .sub { color: #555; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; border-bottom: 1px solid #111; padding: 4px 6px 4px 0; }
  td { border-bottom: 1px solid #ddd; padding: 4px 6px 4px 0; vertical-align: top; }
  tr { page-break-inside: avoid; }
  .note { color: #555; font-size: 10px; margin-top: 16px; }
</style>
</head>
<body>
<h1>Blood pressure report</h1>
<p class="sub">${escapeHtml(o.rangeLabel)}${range ? ` (${escapeHtml(range)})` : ''}. Pressures in ${escapeHtml(o.pressure)}.</p>
${
  stats
    ? `<h2>Summary</h2>
<table>${summary.map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`).join('')}</table>
<h2>Readings</h2>
<table>
${tr(['Date and time', 'Reading', 'Pulse', 'Arm', 'Position', 'Category', 'Notes'], 'th')}
${rows
  .map((r) =>
    tr([
      formatDateTime(r.takenAt),
      pair(r.systolic, r.diastolic),
      r.pulse === null ? '' : String(Math.round(r.pulse)),
      r.arm ? BP_ARM_LABEL[r.arm] : '',
      r.position ? BP_POSITION_LABEL[r.position] : '',
      BP_CATEGORY_LABEL[classifyBp(r.systolic, r.diastolic)],
      noteOf(r),
    ]),
  )
  .join('\n')}
</table>`
    : '<p>No readings in this period.</p>'
}
<p class="note">Prepared with Keel on ${escapeHtml(formatDateTime(o.generatedAt))}. Categories follow the 2017 ACC/AHA adult guidelines and are for information only. This is not a diagnosis or medical advice; please discuss your readings with your doctor.</p>
</body>
</html>
`;
}
