import { buildReport, FrameRecorder, hexToBytes, toHex } from '../recorder';

const bytes = (h: string) => new Uint8Array(Buffer.from(h, 'hex'));

// The owner's real frames (see aabb.test.ts).
const FINAL = bytes('aabbed67395349859100c86affffff2500762a4b05030313');
const IDLE_A = bytes('aabbed6739534985fcffc76affffff040000004b05037312');
const IDLE_B = bytes('aabbed6739534985d6ffc76affffff040000004b05032812');

describe('hexToBytes', () => {
  it('round-trips with toHex', () => {
    expect(toHex(hexToBytes('aabb00ff7f'))).toBe('aabb00ff7f');
    expect(Array.from(hexToBytes('0a1b'))).toEqual([10, 27]);
  });
});

describe('FrameRecorder', () => {
  it('counts duplicates and keeps distinct frames in first-seen order', () => {
    const r = new FrameRecorder();
    r.add(IDLE_A, 0);
    r.add(IDLE_B, 100);
    r.add(IDLE_A, 200);
    expect(r.total).toBe(3);
    expect(r.distinct).toBe(2);
    expect(r.frames().map((f) => [f.hex === toHex(IDLE_A), f.count, f.first, f.last])).toEqual([
      [true, 2, 0, 200],
      [false, 1, 100, 100],
    ]);
  });

  it('reports which byte positions vary', () => {
    const r = new FrameRecorder();
    r.add(IDLE_A, 0);
    r.add(IDLE_B, 100);
    // bytes 8 and 22-23 differ between the two idle frames (fc vs d6; 73 12 vs 28 12)
    expect(r.variedBytes()).toEqual([8, 22]);
  });

  it('shows bytes 19-20 constant across idle and locked frames (no impedance there)', () => {
    const r = new FrameRecorder();
    r.add(IDLE_A, 0);
    r.add(FINAL, 1000);
    const v = r.byteVariation();
    expect(v[19].values).toEqual([{ hex: '4b', count: 2 }]);
    expect(v[20].values).toEqual([{ hex: '05', count: 2 }]);
  });

  it('records a timeline only when status or weight changes', () => {
    const r = new FrameRecorder();
    r.add(IDLE_A, 0);
    r.add(IDLE_B, 100); // same status and weight: not a transition
    r.add(FINAL, 2000);
    expect(r.transitions()).toEqual([
      { t: 0, status: 0x04, weightKg: 0 },
      { t: 2000, status: 0x25, weightKg: 108.7 },
    ]);
  });

  it('stops storing new distinct frames past the limit but keeps counting', () => {
    const r = new FrameRecorder(2);
    for (let i = 0; i < 5; i++) {
      const b = Uint8Array.from(IDLE_A);
      b[22] = i;
      r.add(b, i);
    }
    expect(r.total).toBe(5);
    expect(r.distinct).toBe(2);
  });
});

describe('buildReport', () => {
  it('has the sections needed to compare conditions and stays small', () => {
    const r = new FrameRecorder();
    r.add(IDLE_A, 0);
    r.add(FINAL, 2500);
    const text = buildReport(r, {
      label: 'Barefoot',
      startedAt: new Date(Date.UTC(2026, 9, 8, 21, 0)),
      durationMs: 5000,
      mac: 'ed:67:39:53:49:85',
      otherScaleFrames: 0,
    });
    for (const s of ['Condition: Barefoot', 'Scale MAC: ed:67:39:53:49:85', 'BYTE VARIATION', 'Bytes that vary:', 'TIMELINE', 'RAW FRAMES']) {
      expect(text).toContain(s);
    }
    expect(text).toContain('+2.5s  status 25  weight 108.70 kg');
    expect(text.length).toBeLessThan(6000);
  });
});
