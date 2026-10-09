import { parseSyncState } from '../useSyncState';

describe('parseSyncState', () => {
  it('reads a saved state', () => {
    const s = parseSyncState(JSON.stringify({ version: 1, appleHealth: { enabled: true, synced: ['a', 'b'], lastSyncAt: 5 } }));
    expect(s.appleHealth).toEqual({ enabled: true, synced: ['a', 'b'], lastSyncAt: 5 });
  });

  it('reads Sparky settings and defaults them for older files', () => {
    const s = parseSyncState(
      JSON.stringify({ sparky: { enabled: true, serverUrl: 'https://s.com', includeExtras: true, synced: ['k'], lastSyncAt: 1 } }),
    );
    expect(s.sparky).toMatchObject({ enabled: true, serverUrl: 'https://s.com', includeExtras: true, synced: ['k'], lastProblem: null });
    const old = parseSyncState(JSON.stringify({ appleHealth: { enabled: true, synced: [], lastSyncAt: null } }));
    expect(old.sparky).toMatchObject({ enabled: false, serverUrl: '', includeExtras: false });
    expect(old.appleHealth.enabled).toBe(true);
  });

  it('falls back to off and empty on garbage', () => {
    for (const bad of ['', 'nope', '{}', '{"appleHealth":{"enabled":"yes","synced":[1,"k"]}}']) {
      const s = parseSyncState(bad);
      expect(s.appleHealth.enabled).toBe(false);
      expect(s.appleHealth.synced.every((k) => typeof k === 'string')).toBe(true);
    }
  });
});
