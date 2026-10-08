import { lengthCm, parseTapeFrame } from '../protocol';

const bytes = (h: string) => new Uint8Array(Buffer.from(h.replace(/\s/g, ''), 'hex'));

// Real notifications captured from an RF-BMF01 with nRF Connect (iPhone).
const CAPTURED: [string, number][] = [
  ['2A30 3030 3030 3B30 3030 3030 3B30 3030 3050 4D0A', 0],
  ['2A30 3032 3230 3B30 3030 3030 3B30 3030 3050 4D0A', 220],
  ['2A30 3037 3230 3B30 3030 3030 3B30 3030 3050 4D0A', 720],
  ['2A30 3135 3830 3B30 3030 3030 3B30 3030 3050 4D0A', 1580],
  ['2A30 3130 3130 3B30 3030 3030 3B30 3030 3050 4D0A', 1010],
  ['2A30 3230 3530 3B30 3030 3030 3B30 3030 3050 4D0A', 2050],
  ['2A30 3133 3430 3B30 3030 3030 3B30 3030 3050 4D0A', 1340],
];

describe('parseTapeFrame', () => {
  it.each(CAPTURED)('decodes captured frame %s', (hex, primary) => {
    expect(parseTapeFrame(bytes(hex))).toEqual({
      kind: 'reading',
      primary,
      secondary: 0,
      tertiary: 0,
      suffix: 'PM',
    });
  });

  it('recognises the all-zero heartbeat', () => {
    expect(parseTapeFrame(new Uint8Array(20))).toEqual({ kind: 'idle' });
  });

  it('rejects malformed frames', () => {
    expect(parseTapeFrame(new Uint8Array(0))).toBeNull();
    expect(parseTapeFrame(bytes('2A3030'))).toBeNull();
    expect(parseTapeFrame(new TextEncoder().encode('*0205;00000;0000PM\n'))).toBeNull();
    expect(parseTapeFrame(new TextEncoder().encode('*02050,00000;0000PM\n'))).toBeNull();
  });
});

describe('lengthCm', () => {
  it('converts captured peak 02050 to 20.5 cm (cm mode)', () => {
    const f = parseTapeFrame(bytes('2A30 3230 3530 3B30 3030 3030 3B30 3030 3050 4D0A'));
    expect(f?.kind).toBe('reading');
    if (f?.kind === 'reading') expect(lengthCm(f)).toBeCloseTo(20.5, 5);
  });
});
