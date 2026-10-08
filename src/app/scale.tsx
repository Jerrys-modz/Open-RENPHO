import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { WeighIn } from '@/ble/qn/session';
import { weighInToMeasurements } from '@/ble/qn/measurements';
import { QnScaleConnection } from '@/ble/qn/transport';
import { DEMO_WEIGH_IN, readDemoMode } from '@/demo';
import { addMeasurements } from '@/storage/useMeasurements';
import { Button, Card, MetricRow } from '@/ui/components';
import { METRICS } from '@/ui/metrics';
import { useColors } from '@/ui/theme';
import { ThemedText } from '@/ui/ThemedText';
import { formatNumber } from '@/util/format';

export default function WeighInScreen() {
  const c = useColors();
  const conn = useRef<QnScaleConnection | null>(null);
  const [demo] = useState(() => readDemoMode() === 'scale');
  const [status, setStatus] = useState(demo ? 'Saved to your history' : 'Ready');
  const [live, setLive] = useState<number | null>(null);
  const [result, setResult] = useState<WeighIn | null>(demo ? DEMO_WEIGH_IN : null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => conn.current?.destroy(), []);

  const begin = () => {
    conn.current?.destroy();
    conn.current = new QnScaleConnection();
    setResult(null);
    setLive(null);
    setError(null);
    conn.current.start({
      onStatus: setStatus,
      onLiveWeight: setLive,
      onWeighIn: (w) => {
        setResult(w);
        addMeasurements(weighInToMeasurements(w, Date.now()));
        setStatus('Saved to your history');
      },
      onError: (m) => {
        setError(m);
        setStatus('Something went wrong');
      },
    });
  };

  const shown = result?.weightKg ?? live;
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.hero}>
        <ThemedText subtle style={styles.status}>
          {status}
        </ThemedText>
        <ThemedText style={styles.weight}>
          {shown === null ? '--' : formatNumber(shown, 2)}{' '}
          <ThemedText subtle style={styles.unit}>
            kg
          </ThemedText>
        </ThemedText>
        {error && <ThemedText style={{ color: c.danger, textAlign: 'center' }}>{error}</ThemedText>}
      </Card>

      {result && (
        <Card>
          <MetricRow def={METRICS[0]} value={formatNumber(result.weightKg, 2)} />
          {result.bodyFat !== null && <MetricRow def={METRICS[1]} value={formatNumber(result.bodyFat, 1)} />}
          <View style={[styles.detail, { borderTopColor: c.border }]}>
            <ThemedText subtle>Impedance</ThemedText>
            <ThemedText>{result.resistance1 ?? 'n/a'} Ω</ThemedText>
          </View>
        </Card>
      )}

      <Button title={result ? 'Weigh again' : 'Start weigh-in'} onPress={begin} style={styles.button} />
      <ThemedText subtle style={styles.hint}>
        Tap the button, then step on the scale barefoot. It wakes up when you stand on it.
      </ThemedText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  hero: { alignItems: 'center', paddingVertical: 28 },
  status: { fontSize: 15 },
  weight: { fontSize: 64, fontWeight: '700' },
  unit: { fontSize: 24, fontWeight: '400' },
  detail: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  button: { flex: 0 },
  hint: { textAlign: 'center', fontSize: 13 },
});
