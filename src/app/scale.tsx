import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { weighInToMeasurements } from '@/ble/qn/measurements';
import { toScaleProfile } from '@/ble/qn/profile';
import { ScaleConnection } from '@/ble/scale/connection';
import type { Measurement } from '@/domain/measurement';
import { DEMO_PROFILE, DEMO_WEIGH_IN, readDemoMode } from '@/demo';
import { addMeasurements } from '@/storage/useMeasurements';
import { getProfile, useProfile } from '@/storage/useProfile';
import { useUnits } from '@/storage/useSettings';
import { Button, Card, MetricRow } from '@/ui/components';
import { SCALE_METRICS } from '@/ui/metrics';
import { useColors } from '@/ui/theme';
import { ThemedText } from '@/ui/ThemedText';
import { formatForDisplay } from '@/util/units';

export default function WeighInScreen() {
  const c = useColors();
  const profile = useProfile();
  const units = useUnits();
  const conn = useRef<ScaleConnection | null>(null);
  const [demo] = useState(() => readDemoMode() === 'scale');
  const [status, setStatus] = useState(demo ? 'Saved to your history' : 'Ready');
  const [live, setLive] = useState<number | null>(null);
  const [saved, setSaved] = useState<Measurement[] | null>(
    demo ? weighInToMeasurements(DEMO_WEIGH_IN, Date.UTC(2026, 9, 8), DEMO_PROFILE) : null,
  );
  const [flavor, setFlavor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => conn.current?.destroy(), []);

  const begin = () => {
    conn.current?.destroy();
    conn.current = new ScaleConnection();
    setSaved(null);
    setFlavor(null);
    setLive(null);
    setError(null);
    const p = getProfile();
    conn.current.start({
      // Without a profile we tell the scale not to calculate body fat.
      profile: p ? toScaleProfile(p) : undefined,
      onStatus: setStatus,
      onLiveWeight: setLive,
      onWeighIn: (w) => {
        setFlavor(w.flavor);
        const ms = weighInToMeasurements(w, Date.now(), getProfile());
        addMeasurements(ms);
        setSaved(ms);
        setStatus('Saved to your history');
      },
      onError: (m) => {
        setError(m);
        setStatus('Something went wrong');
      },
    });
  };

  const weight = saved?.find((m) => m.type === 'weight')?.value ?? live;
  const impedance = saved?.find((m) => m.type === 'impedance')?.value;
  const rows = SCALE_METRICS.flatMap((def) => {
    const m = saved?.find((x) => x.type === def.key.type);
    return m ? [{ def, value: m.value }] : [];
  });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.hero}>
        <ThemedText subtle style={styles.status}>
          {status}
        </ThemedText>
        <ThemedText style={styles.weight}>
          {weight === null || weight === undefined ? '--' : formatForDisplay({ unit: 'kg', digits: 2 }, weight, units).text}{' '}
          <ThemedText subtle style={styles.unit}>
            {units === 'imperial' ? 'lb' : 'kg'}
          </ThemedText>
        </ThemedText>
        {error && <ThemedText style={{ color: c.danger, textAlign: 'center' }}>{error}</ThemedText>}
      </Card>

      {!profile && (
        <Card>
          <ThemedText style={styles.profileTitle}>Add your profile for body fat and more</ThemedText>
          <ThemedText subtle style={styles.hint}>
            The scale reports your weight. Body fat, BMI, water, muscle and bone are calculated from your sex, age and height.
          </ThemedText>
          <Button title="Set up profile" variant="secondary" onPress={() => router.push('/profile')} style={styles.profileButton} />
        </Card>
      )}

      {rows.length > 0 && (
        <Card>
          {rows.map(({ def, value }) => (
            <MetricRow
              key={def.id}
              def={def}
              value={formatForDisplay(def.key.type === 'weight' ? { ...def, digits: 2 } : def, value, units).text}
              unit={formatForDisplay(def, value, units).unit}
            />
          ))}
          {impedance !== undefined && (
            <View style={[styles.detail, { borderTopColor: c.border }]}>
              <ThemedText subtle>Impedance</ThemedText>
              <ThemedText>{impedance} Ω</ThemedText>
            </View>
          )}
        </Card>
      )}

      <Button title={saved ? 'Weigh again' : 'Start weigh-in'} onPress={begin} style={styles.button} />
      <ThemedText subtle style={styles.hint}>
        Tap the button, then step on the scale barefoot. It wakes up when you stand on it.
      </ThemedText>
      {flavor === 'broadcast' && (
        <ThemedText subtle style={styles.hint}>
          This scale model only broadcasts your weight and sends no impedance, so body fat and the numbers derived from it are
          estimated from your weight, height, age and sex.
        </ThemedText>
      )}
      {profile && rows.length > 0 && (
        <ThemedText subtle style={styles.hint}>
          BMI, water, muscle, bone and the rest are calculated from your body fat, so they can differ from the RENPHO app.
        </ThemedText>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  hero: { alignItems: 'center', paddingVertical: 28 },
  status: { fontSize: 15 },
  weight: { fontSize: 64, fontWeight: '700' },
  unit: { fontSize: 24, fontWeight: '400' },
  profileTitle: { fontSize: 17, fontWeight: '600' },
  profileButton: { flex: 0 },
  detail: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  button: { flex: 0 },
  hint: { textAlign: 'center', fontSize: 13 },
});
