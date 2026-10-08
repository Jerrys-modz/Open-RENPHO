import { useTheme } from 'expo-router';
import { ThemedText } from '@/ui/ThemedText';
import { useEffect, useRef, useState } from 'react';
import { Button, ScrollView, StyleSheet, View } from 'react-native';
import { QnScaleConnection } from '@/ble/qn/transport';
import type { WeighIn } from '@/ble/qn/session';
import { DEMO_WEIGH_IN, readDemoMode } from '@/demo';

export default function WeighInScreen() {
  const { colors } = useTheme();
  const conn = useRef<QnScaleConnection | null>(null);
  const [demo] = useState(() => readDemoMode() === 'scale');
  const [status, setStatus] = useState(demo ? 'Done' : 'Idle');
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
      onWeighIn: setResult,
      onError: (m) => {
        setError(m);
        setStatus('Error');
      },
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText style={styles.status}>{status}</ThemedText>
      <ThemedText style={styles.weight}>
        {(result?.weightKg ?? live)?.toFixed(2) ?? '--'} <ThemedText style={styles.unit}>kg</ThemedText>
      </ThemedText>
      {result && (
        <View style={[styles.card, { borderColor: colors.border }]}>
          <ThemedText>Flavor: {result.flavor}</ThemedText>
          <ThemedText>Impedance: {result.resistance1 ?? 'n/a'} Ω</ThemedText>
          <ThemedText>On-device body fat: {result.bodyFat ?? 'n/a'}</ThemedText>
        </View>
      )}
      {error && <ThemedText style={styles.error}>{error}</ThemedText>}
      <Button title="Start weigh-in" onPress={begin} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16, alignItems: 'center' },
  status: { fontSize: 16, opacity: 0.7 },
  weight: { fontSize: 64, fontWeight: '700' },
  unit: { fontSize: 24, fontWeight: '400' },
  card: { gap: 4, padding: 16, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  error: { color: 'crimson' },
});
