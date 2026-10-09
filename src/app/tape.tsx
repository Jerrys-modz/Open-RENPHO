import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { TapeConnection } from '@/ble/tape/transport';
import type { Measurement } from '@/domain/measurement';
import { DEMO_TAPE, readDemoMode } from '@/demo';
import { addMeasurements, useMeasurements } from '@/storage/useMeasurements';
import { syncAppleHealth } from '@/sync';
import { useUnits } from '@/storage/useSettings';
import { Button, Card, MetricIcon, MetricRow, SectionTitle } from '@/ui/components';
import { METRICS, metricById } from '@/ui/metrics';
import { useColors } from '@/ui/theme';
import { ThemedText } from '@/ui/ThemedText';
import { formatDateTime } from '@/util/format';
import { formatForDisplay, type UnitSystem } from '@/util/units';

const SITE_DEFS = METRICS.filter((m) => m.key.type === 'circumference');
const CM_PER_IN = 2.54;
const CM_DEF = { unit: 'cm', digits: 1 };

/** The other system's value, for the small line under the big one. */
const otherUnit = (cm: number, units: UnitSystem) =>
  units === 'metric' ? `${(cm / CM_PER_IN).toFixed(2)} in` : `${cm.toFixed(1)} cm`;

export default function TapeScreen() {
  const c = useColors();
  const units = useUnits();
  const conn = useRef<TapeConnection | null>(null);
  const siteRef = useRef<string>(SITE_DEFS[0].id);
  const [site, setSite] = useState<string>(SITE_DEFS[0].id);
  const [demo] = useState(() => readDemoMode() === 'tape');
  const [status, setStatus] = useState(demo ? 'Connected. Measure, then press ✓ on the tape to save.' : 'Ready');
  const [cm, setCm] = useState<number | null>(demo ? DEMO_TAPE.cm : null);
  const [raw, setRaw] = useState<string[]>(demo ? ['*03150;00000;0000PI\\x0a'] : []);
  const [error, setError] = useState<string | null>(null);
  const list = useMeasurements();

  useEffect(() => {
    return () => {
      void conn.current?.stop();
    };
  }, []);

  const begin = () => {
    void conn.current?.stop();
    const t = new TapeConnection();
    conn.current = t;
    setError(null);
    t.start({
      onStatus: setStatus,
      onRaw: (line) => setRaw((r) => [line, ...r].slice(0, 5)),
      onLength: (v) => setCm(v),
      onSave: (v) => {
        const m: Measurement = {
          type: 'circumference',
          value: v,
          takenAt: Date.now(),
          source: 'rf-bmf01',
          site: siteRef.current,
        };
        addMeasurements([m]);
        void syncAppleHealth();
      },
      onError: (m) => {
        setError(m);
        setStatus('Something went wrong');
      },
    });
  };

  const saved = list
    .filter((m) => m.type === 'circumference')
    .sort((a, b) => b.takenAt - a.takenAt)
    .slice(0, 8);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.hero}>
        <ThemedText subtle style={styles.status}>
          {status}
        </ThemedText>
        <ThemedText style={styles.length}>
          {cm === null ? '--' : formatForDisplay(CM_DEF, cm, units).text}{' '}
          <ThemedText subtle style={styles.unit}>
            {units === 'imperial' ? 'in' : 'cm'}
          </ThemedText>
        </ThemedText>
        <ThemedText subtle style={styles.inches}>
          {cm === null ? ' ' : otherUnit(cm, units)}
        </ThemedText>
        {error && <ThemedText style={{ color: c.danger, textAlign: 'center' }}>{error}</ThemedText>}
      </Card>

      <Button title="Connect tape" onPress={begin} style={styles.button} />

      <SectionTitle>Save next reading as</SectionTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sites}>
        {SITE_DEFS.map((d) => (
          <Pressable
            key={d.id}
            style={styles.site}
            onPress={() => {
              siteRef.current = d.id;
              setSite(d.id);
            }}
          >
            <MetricIcon def={d} active={d.id === site} />
            <ThemedText subtle={d.id !== site} style={styles.siteLabel}>
              {d.label}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>
      <ThemedText subtle style={styles.hint}>
        Pull the tape round, then press ✓ on it to save.
      </ThemedText>

      <SectionTitle>Saved readings</SectionTitle>
      <Card>
        {saved.length === 0 ? (
          <ThemedText subtle style={styles.hint}>
            Nothing saved yet.
          </ThemedText>
        ) : (
          saved.map((m) => (
            <MetricRow
              key={`${m.takenAt}-${m.site}`}
              def={metricById(m.site ?? 'waist')}
              value={formatForDisplay(CM_DEF, m.value, units).text}
              unit={formatForDisplay(CM_DEF, m.value, units).unit}
              caption={`${otherUnit(m.value, units)}  ·  ${formatDateTime(m.takenAt)}`}
            />
          ))
        )}
      </Card>

      <SectionTitle>Raw frames (debug)</SectionTitle>
      <View style={[styles.debug, { backgroundColor: c.card }]}>
        {raw.length === 0 ? (
          <ThemedText subtle style={styles.mono}>
            none yet
          </ThemedText>
        ) : (
          raw.map((t, i) => (
            <ThemedText key={i} style={styles.mono}>
              {t}
            </ThemedText>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  hero: { alignItems: 'center', paddingVertical: 24, gap: 4 },
  status: { fontSize: 15, textAlign: 'center' },
  length: { fontSize: 64, fontWeight: '700' },
  unit: { fontSize: 24, fontWeight: '400' },
  inches: { fontSize: 20 },
  button: { flex: 0 },
  sites: { gap: 14, paddingVertical: 4 },
  site: { alignItems: 'center', gap: 4 },
  siteLabel: { fontSize: 12 },
  hint: { fontSize: 13, textAlign: 'center' },
  debug: { borderRadius: 12, padding: 12, gap: 2 },
  mono: { fontFamily: 'Menlo', fontSize: 12 },
});
