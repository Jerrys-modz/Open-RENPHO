/**
 * Records every broadcast packet of one scale so that we can see which bytes change with what you do
 * (barefoot, socks, wet feet, nothing on the scale). Used by the Scale capture debug screen.
 * Pure logic; no Bluetooth here.
 */

export interface FrameStat {
  hex: string;
  /** Milliseconds after the capture started. */
  first: number;
  last: number;
  count: number;
}

export interface ByteValue {
  hex: string;
  count: number;
}

export interface ByteVariation {
  index: number;
  values: ByteValue[];
  /** True when more distinct values were seen than we keep. */
  overflow: boolean;
}

export interface Transition {
  t: number;
  status: number;
  weightKg: number;
}

const MAX_VALUES_PER_BYTE = 64;
const MAX_TRANSITIONS = 500;

const hex2 = (n: number) => n.toString(16).padStart(2, '0');
export const toHex = (b: Uint8Array) => Array.from(b, hex2).join('');

/** Parses a hex string (no `Buffer` on the phone's JS runtime, so do it by hand). */
export function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export class FrameRecorder {
  private frameMap = new Map<string, FrameStat>();
  private byteMaps: Map<string, number>[] = [];
  private overflowed = new Set<number>();
  private transitionList: Transition[] = [];
  private lastKey = '';
  private frames_ = 0;

  constructor(private readonly maxDistinct = 3000) {}

  /** `payload` is the manufacturer data from the `AA BB` prefix on; `t` is ms since the capture began. */
  add(payload: Uint8Array, t: number): void {
    this.frames_++;
    const hex = toHex(payload);

    const known = this.frameMap.get(hex);
    if (known) {
      known.count++;
      known.last = t;
    } else if (this.frameMap.size < this.maxDistinct) {
      this.frameMap.set(hex, { hex, first: t, last: t, count: 1 });
    }

    for (let i = 0; i < payload.length; i++) {
      const m = (this.byteMaps[i] ??= new Map());
      const v = hex2(payload[i]);
      if (m.has(v)) m.set(v, m.get(v)! + 1);
      else if (m.size < MAX_VALUES_PER_BYTE) m.set(v, 1);
      else this.overflowed.add(i);
    }

    if (payload.length > 18) {
      const status = payload[15];
      const weightKg = (payload[17] | (payload[18] << 8)) / 100;
      const key = `${status}:${weightKg}`;
      if (key !== this.lastKey && this.transitionList.length < MAX_TRANSITIONS) {
        this.transitionList.push({ t, status, weightKg });
      }
      this.lastKey = key;
    }
  }

  get total(): number {
    return this.frames_;
  }

  get distinct(): number {
    return this.frameMap.size;
  }

  /** In order of first appearance. */
  frames(): FrameStat[] {
    return Array.from(this.frameMap.values());
  }

  transitions(): readonly Transition[] {
    return this.transitionList;
  }

  byteVariation(): ByteVariation[] {
    return this.byteMaps.map((m, index) => ({
      index,
      values: Array.from(m, ([hex, count]) => ({ hex, count })).sort((a, b) => b.count - a.count),
      overflow: this.overflowed.has(index),
    }));
  }

  /** Byte positions that took more than one value. */
  variedBytes(): number[] {
    return this.byteVariation()
      .filter((b) => b.values.length > 1)
      .map((b) => b.index);
  }
}

export interface ReportInfo {
  label: string;
  startedAt: Date;
  durationMs: number;
  mac: string | null;
  /** Frames from other AABB scales that were ignored. */
  otherScaleFrames: number;
}

const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

/** A compact text report (a few kB) that is easy to paste into a message. */
export function buildReport(r: FrameRecorder, info: ReportInfo, rawLimit = 300): string {
  const lines: string[] = [];
  lines.push('Open RENPHO scale capture');
  lines.push(`Condition: ${info.label}`);
  lines.push(`Started: ${info.startedAt.toISOString()}  Duration: ${secs(info.durationMs)}`);
  lines.push(`Scale MAC: ${info.mac ?? 'none seen'}${info.otherScaleFrames ? `  (ignored ${info.otherScaleFrames} frames from other scales)` : ''}`);
  lines.push(`Frames: ${r.total} total, ${r.distinct} distinct`);

  lines.push('', 'BYTE VARIATION  [index] value xcount (most common first)');
  for (const b of r.byteVariation()) {
    const shown = b.values.slice(0, 12).map((v) => `${v.hex} x${v.count}`).join('  ');
    const more = b.values.length > 12 ? `  … +${b.values.length - 12} more` : b.overflow ? '  … many more' : '';
    lines.push(`[${String(b.index).padStart(2)}] ${shown}${more}`);
  }
  lines.push(`Bytes that vary: ${r.variedBytes().join(', ') || 'none'}`);

  lines.push('', 'TIMELINE  (each change of status or weight)');
  for (const t of r.transitions()) {
    lines.push(`+${secs(t.t)}  status ${hex2(t.status)}  weight ${t.weightKg.toFixed(2)} kg`);
  }

  const frames = r.frames();
  lines.push('', `RAW FRAMES  (first ${Math.min(rawLimit, frames.length)} of ${frames.length} distinct, in order seen)`);
  for (const f of frames.slice(0, rawLimit)) {
    lines.push(`+${secs(f.first)} x${f.count}  ${f.hex}`);
  }
  return lines.join('\n');
}
