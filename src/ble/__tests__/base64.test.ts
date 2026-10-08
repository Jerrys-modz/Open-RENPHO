import { base64ToBytes, bytesToBase64 } from '../base64';

describe('base64', () => {
  it.each([[0], [1], [2], [3], [4], [5], [13], [255]])('round-trips %i bytes and matches Buffer', (n) => {
    const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) & 0xff);
    const expected = Buffer.from(bytes).toString('base64');
    expect(bytesToBase64(bytes)).toBe(expected);
    expect(Array.from(base64ToBytes(expected))).toEqual(Array.from(bytes));
  });
});
