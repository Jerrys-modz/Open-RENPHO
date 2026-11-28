import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { BP_CATEGORY_COLOR, BP_CATEGORY_LABEL, averageBp, averageByPartOfDay, bpContextText, classifyBp, type BpReading } from '@/domain/bloodPressure';
import { formatDateTime } from '@/util/format';
import { formatForDisplay, type PressureUnit, type UnitSystem } from '@/util/units';
import { Card } from './components';
import { ThemedText } from './ThemedText';

const BP_DEF = { unit: 'mmHg', digits: 0 };

interface Props {
  readings: readonly BpReading[];
  units: UnitSystem;
  pressure: PressureUnit;
  /** Show the newest reading with its category. Off where the screen already shows it. */
  showLatest?: boolean;
  /** Tapping opens the cuff screen. Off on that screen. */
  linked?: boolean;
  /** Also show the 30-day averages before noon and from noon on. */
  showTimeOfDay?: boolean;
}

export function BloodPressureSummary({ readings, units, pressure, showLatest = true, linked = false, showTimeOfDay = false }: Props) {
  if (readings.length === 0) return null;
  const latest = readings[0];
  const category = classifyBp(latest.systolic, latest.diastolic);
  const fmt = (v: number) => formatForDisplay(BP_DEF, v, units, pressure).text;
  const pair = (s: number, d: number) => `${fmt(s)}/${fmt(d)}`;
  const notes = [
    bpContextText(latest),
    latest.irregularPulse && 'Irregular pulse flagged',
    latest.bodyMovement && 'Movement during reading',
  ].filter((n): n is string => typeof n === 'string');
  const windows = [
    { label: '7-day average', avg: averageBp(readings, 7) },
    { label: '30-day average', avg: averageBp(readings, 30) },
  ].flatMap((w) => (w.avg ? [{ label: w.label, avg: w.avg }] : []));
  const parts = averageByPartOfDay(readings, 30);
  const timeOfDay = [
    { label: 'Before noon, 30 days', avg: parts.morning },
    { label: 'Noon and after, 30 days', avg: parts.evening },
  ].flatMap((w) => (w.avg ? [{ label: w.label, avg: w.avg }] : []));

  const body = (
    <Card style={styles.card}>
      {showLatest && (
        <View style={styles.latest}>
          <View style={{ flex: 1 }}>
            <ThemedText subtle style={styles.small}>
              Blood pressure
            </ThemedText>
            <ThemedText style={styles.big}>
              {pair(latest.systolic, latest.diastolic)}{' '}
              <ThemedText subtle style={styles.unit}>
                {pressure}
              </ThemedText>
            </ThemedText>
            <ThemedText subtle style={styles.small}>
              {formatDateTime(latest.takenAt)}
              {latest.pulse !== null ? ` · pulse ${Math.round(latest.pulse)}` : ''}
            </ThemedText>
          </View>
          <View style={[styles.chip, { backgroundColor: BP_CATEGORY_COLOR[category] }]}>
            <ThemedText style={styles.chipText}>{BP_CATEGORY_LABEL[category]}</ThemedText>
          </View>
        </View>
      )}
      {showLatest && notes.length > 0 && (
        <ThemedText subtle style={styles.small}>
          {notes.join(' · ')}
        </ThemedText>
      )}
      <View style={styles.averages}>
        {windows.map(({ label, avg }) => (
          <View key={label} style={{ flex: 1 }}>
            <ThemedText subtle style={styles.small}>
              {label}
            </ThemedText>
            <ThemedText style={styles.avg}>{pair(avg.systolic, avg.diastolic)}</ThemedText>
            <ThemedText subtle style={styles.small}>
              {avg.count} reading{avg.count === 1 ? '' : 's'}
            </ThemedText>
          </View>
        ))}
      </View>
      {showTimeOfDay && timeOfDay.length > 0 && (
        <View style={styles.averages}>
          {timeOfDay.map(({ label, avg }) => (
            <View key={label} style={{ flex: 1 }}>
              <ThemedText subtle style={styles.small}>
                {label}
              </ThemedText>
              <ThemedText style={styles.avg}>{pair(avg.systolic, avg.diastolic)}</ThemedText>
              <ThemedText subtle style={styles.small}>
                {avg.count} reading{avg.count === 1 ? '' : 's'}
              </ThemedText>
            </View>
          ))}
        </View>
      )}
      <ThemedText subtle style={styles.note}>
        Categories follow the 2017 ACC/AHA adult guidelines. For information only, not medical advice.
      </ThemedText>
    </Card>
  );
  return linked ? <Pressable onPress={() => router.push('/bp')}>{body}</Pressable> : body;
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  latest: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  small: { fontSize: 13 },
  big: { fontSize: 30, fontWeight: '700' },
  unit: { fontSize: 15, fontWeight: '400' },
  chip: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  averages: { flexDirection: 'row', gap: 12 },
  avg: { fontSize: 20, fontWeight: '600' },
  note: { fontSize: 11 },
});
