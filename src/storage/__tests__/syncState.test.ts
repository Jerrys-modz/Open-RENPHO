import { parseSyncState } from '../useSyncState';

describe('parseSyncState', () => {
  it('reads a saved state', () => {
    const s = parseSyncState(JSON.stringify({ version: 1, appleHealth: { enabled: true, synced: ['a', 'b'], lastSyncAt: 5 } }));
    expect(s.appleHealth).toEqual({ enabled: true, synced: ['a', 'b'], lastSyncAt: 5 });
  });

  it('falls back to off and empty on garbage', () => {
    for (const bad of ['', 'nope', '{}', '{"appleHealth":{"enabled":"yes","synced":[1,"k"]}}']) {
      const s = parseSyncState(bad);
      expect(s.appleHealth.enabled).toBe(false);
      expect(s.appleHealth.synced.every((k) => typeof k === 'string')).toBe(true);
    }
  });
});
