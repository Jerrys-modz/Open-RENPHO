import { parseDemoMode } from '../demo';

jest.mock('expo-file-system', () => ({ File: class {}, Paths: {} }));

describe('parseDemoMode', () => {
  it.each(['home', 'scale', 'tape', 'profile', 'capture'])('accepts %s (with whitespace)', (s) => {
    expect(parseDemoMode(`  ${s}\n`)).toBe(s);
  });
  it('rejects anything else', () => {
    expect(parseDemoMode('')).toBeNull();
    expect(parseDemoMode('history')).toBeNull();
  });
});
