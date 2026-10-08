export function formatNumber(v: number, digits: number): string {
  return v.toFixed(digits);
}

/** "+0.2" / "-0.3" / "0.0", for change-since-last values. */
export function formatDelta(d: number, digits: number): string {
  const s = d.toFixed(digits);
  return d > 0 && Number(s) !== 0 ? `+${s}` : Number(s) === 0 ? (0).toFixed(digits) : s;
}

export function formatDateTime(t: number): string {
  return new Date(t).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatShortDate(t: number): string {
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatLongDate(d: Date): string {
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}
