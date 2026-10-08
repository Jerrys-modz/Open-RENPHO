import { useEffect, useRef, useState } from 'react';
import { Button, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { TapeConnection } from '@/ble/tape/transport';
import { DEMO_TAPE, readDemoMode } from '@/demo';

const SITES = ['waist', 'hips', 'chest', 'neck', 'bicep', 'thigh', 'calf'] as const;
const CM_PER_IN = 2.54;

interface Saved {
  at: number;
  cm: number;
  site: string;
}

export default function TapeScreen() {
  const conn = useRef<TapeConnection | null>(null);
  const siteRef = useRef<string>(SITES[0]);
  const [site, setSite] = useState<string>(SITES[0]);
  const [demo] = useState(() => readDemoMode() === 'tape');
  const [status, setStatus] = useState(demo ? 'Connected. Measure with the tape; press ✓ to save.' : 'Idle');
  const [cm, setCm] = useState<number | null>(demo ? DEMO_TAPE.cm : null);
  const [saved, setSaved] = useState<Saved[]>(demo ? DEMO_TAPE.saved : []);
  const [raw, setRaw] = useState<string[]>(demo ? ['*03150;00000;0000PI\\x0a'] : []);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      void conn.current?.stop();
    };
  }, []);

  const begin = () => {
    void conn.current?.stop();
    const c = new TapeConnection();
    conn.current = c;
    setError(null);
    c.start({
      onStatus: setStatus,
      onRaw: (t) => setRaw((r) => [t, ...r].slice(0, 6)),
      onLength: (v) => setCm(v),
      onSave: (v) => setSaved((s) => [{ at: Date.now(), cm: v, site: siteRef.current }, ...s]),
      onError: (m) => {
        setError(m);
        setStatus('Error');
      },
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.status}>{status}</Text>
      <Text style={styles.length}>
        {cm === null ? '--' : cm.toFixed(1)} <Text style={styles.unit}>cm</Text>
      </Text>
      <Text style={styles.inches}>{cm === null ? '' : `${(cm / CM_PER_IN).toFixed(2)} in`}</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <Button title="Connect tape" onPress={begin} />

      <Text style={styles.heading}>Body site for next save</Text>
      <View style={styles.sites}>
        {SITES.map((s) => (
          <Pressable
            key={s}
            onPress={() => {
              siteRef.current = s;
              setSite(s);
            }}
            style={[styles.chip, s === site && styles.chipOn]}
          >
            <Text style={s === site ? styles.chipOnText : undefined}>{s}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>Press ✓ on the tape to save a reading.</Text>

      <FlatList
        style={styles.list}
        data={saved}
        keyExtractor={(i) => String(i.at)}
        ListEmptyComponent={<Text style={styles.hint}>No saved readings yet.</Text>}
        renderItem={({ item }) => (
          <Text style={styles.row}>
            {item.site}: {item.cm.toFixed(1)} cm ({(item.cm / CM_PER_IN).toFixed(2)} in)
          </Text>
        )}
      />

      <Text style={styles.heading}>Raw frames (debug)</Text>
      {raw.map((t, i) => (
        <Text key={i} style={styles.mono}>
          {t}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8 },
  status: { fontSize: 16, opacity: 0.7, textAlign: 'center' },
  length: { fontSize: 64, fontWeight: '700', textAlign: 'center' },
  unit: { fontSize: 24, fontWeight: '400' },
  inches: { fontSize: 20, textAlign: 'center', opacity: 0.7 },
  error: { color: 'crimson', textAlign: 'center' },
  heading: { marginTop: 12, fontWeight: '600' },
  sites: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  chipOn: { backgroundColor: '#0a84ff', borderColor: '#0a84ff' },
  chipOnText: { color: 'white' },
  hint: { opacity: 0.6 },
  list: { flexGrow: 0, maxHeight: 160 },
  row: { paddingVertical: 4 },
  mono: { fontFamily: 'Menlo', fontSize: 12 },
});
