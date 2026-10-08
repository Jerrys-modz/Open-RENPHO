import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { readDemoMode } from '@/demo';
import { latestWithDelta, seriesFor } from '@/storage/measurements';
import { useMeasurements } from '@/storage/useMeasurements';
import { useProfile } from '@/storage/useProfile';
import { Button, Card, MetricIcon, MetricRow, SectionTitle } from '@/ui/components';
import { METRICS, SCALE_METRICS, TAPE_METRICS, metricById, type MetricDef } from '@/ui/metrics';
import { ThemedText } from '@/ui/ThemedText';
import { TrendChart } from '@/ui/TrendChart';
import { formatDateTime, formatDelta, formatNumber, formatShortDate } from '@/util/format';

const arrow = (d: number) => (d > 0 ? '↑' : d < 0 ? '↓' : '→');

export default function Overview() {
  // CI screenshots: a demo-mode file picks the screen to open (see src/demo.ts).
  const [demo] = useState(readDemoMode);
  const list = useMeasurements();
  const profile = useProfile();
  const [selected, setSelected] = useState('weight');

  if (demo === 'scale' || demo === 'tape' || demo === 'profile') return <Redirect href={`/${demo}`} />;

  const def = metricById(selected);
  const series = seriesFor(list, def.key);
  const latest = latestWithDelta(list, def.key);
  const hasData = list.length > 0;

  const weight = latestWithDelta(list, SCALE_METRICS[0].key);
  const scaleRows = SCALE_METRICS.flatMap((m) => {
    const l = latestWithDelta(list, m.key);
    return l ? [{ m, l }] : [];
  });
  const tapeRows = TAPE_METRICS.flatMap((m) => {
    const l = latestWithDelta(list, m.key);
    return l ? [{ m, l }] : [];
  });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {METRICS.map((m) => (
          <Pressable key={m.id} onPress={() => setSelected(m.id)} accessibilityLabel={m.label} style={styles.chip}>
            {/* Colour when there is data for it, grey when there isn't; a ring marks the chosen one. */}
            <MetricIcon def={m} active={seriesFor(list, m.key).length > 0} selected={m.id === selected} />
            <ThemedText subtle={m.id !== selected} style={styles.chipLabel}>
              {m.label}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>

      <Card>
        <View style={styles.chartHeader}>
          <View>
            <ThemedText subtle style={styles.small}>
              {def.label}
            </ThemedText>
            <ThemedText style={styles.big}>
              {latest ? formatNumber(latest.point.v, def.digits) : '--'}{' '}
              <ThemedText subtle style={styles.unit}>
                {def.unit}
              </ThemedText>
            </ThemedText>
          </View>
          {latest?.delta != null && (
            <ThemedText subtle style={styles.delta}>
              {arrow(latest.delta)} {formatDelta(latest.delta, def.digits)} {def.unit}
            </ThemedText>
          )}
        </View>
        {series.length > 0 ? (
          <TrendChart points={series} color={def.color} />
        ) : (
          <ThemedText subtle style={styles.empty}>
            {hasData ? `No ${def.label.toLowerCase()} readings yet.` : 'No measurements yet. Weigh in or measure to get started.'}
          </ThemedText>
        )}
      </Card>

      {!profile && (
        <Card>
          <ThemedText style={styles.profileTitle}>Set up your profile</ThemedText>
          <ThemedText subtle style={styles.profileText}>
            Add your sex, age and height to get body fat, BMI, water, muscle and bone from your scale.
          </ThemedText>
          <Button title="Set up profile" variant="secondary" onPress={() => router.push('/profile')} style={styles.profileButton} />
        </Card>
      )}

      {scaleRows.length > 0 && weight && (
        <>
          <SectionTitle>{formatDateTime(weight.point.t)}</SectionTitle>
          <Card>
            {scaleRows.map(({ m, l }) => (
              <MetricRow key={m.id} def={m} value={formatNumber(l.point.v, m.digits)} delta={deltaText(l.delta, m)} />
            ))}
          </Card>
        </>
      )}

      {tapeRows.length > 0 && (
        <>
          <SectionTitle>Tape measurements</SectionTitle>
          <Card>
            {tapeRows.map(({ m, l }) => (
              <MetricRow
                key={m.id}
                def={m}
                value={formatNumber(l.point.v, m.digits)}
                delta={deltaText(l.delta, m)}
                caption={formatShortDate(l.point.t)}
              />
            ))}
          </Card>
        </>
      )}

      <View style={styles.actions}>
        <Button title="Weigh in" onPress={() => router.push('/scale')} />
        <Button title="Measure" variant="secondary" onPress={() => router.push('/tape')} />
      </View>
    </ScrollView>
  );
}

function deltaText(d: number | null, m: MetricDef): string | null {
  return d === null ? null : `${arrow(d)} ${formatDelta(d, m.digits)} ${m.unit}`;
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  chips: { gap: 12, paddingVertical: 4 },
  chip: { alignItems: 'center', gap: 4 },
  chipLabel: { fontSize: 12 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  small: { fontSize: 14 },
  big: { fontSize: 34, fontWeight: '700' },
  unit: { fontSize: 16, fontWeight: '400' },
  delta: { fontSize: 15, marginTop: 4 },
  empty: { textAlign: 'center', paddingVertical: 24 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  profileTitle: { fontSize: 17, fontWeight: '600' },
  profileText: { fontSize: 14 },
  profileButton: { flex: 0 },
});
