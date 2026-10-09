import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { groupEntries, type Entry } from '@/storage/measurements';
import { deleteEntry, useMeasurements } from '@/storage/useMeasurements';
import { useUnits } from '@/storage/useSettings';
import { Button, Card } from '@/ui/components';
import { METRICS, metricById } from '@/ui/metrics';
import { ThemedText } from '@/ui/ThemedText';
import { formatDateTime } from '@/util/format';
import { formatForDisplay, type UnitSystem } from '@/util/units';

function summary(e: Entry, units: UnitSystem): { title: string; detail: string } {
  if (e.kind === 'tape') {
    const m = e.measurements[0];
    const def = METRICS.find((d) => d.key.type === 'circumference' && d.key.site === m.site) ?? metricById('waist');
    const f = formatForDisplay(def, m.value, units);
    return { title: `${def.label} ${f.text} ${f.unit}`, detail: 'Tape measure' };
  }
  const weight = e.measurements.find((m) => m.type === 'weight');
  const fat = e.measurements.find((m) => m.type === 'body_fat');
  const w = weight ? formatForDisplay(metricById('weight'), weight.value, units) : null;
  return {
    title: w ? `${w.text} ${w.unit}` : 'Weigh-in',
    detail: fat ? `Body fat ${fat.value.toFixed(1)}%` : 'Weight only',
  };
}

export default function HistoryScreen() {
  const list = useMeasurements();
  const units = useUnits();
  const entries = groupEntries(list);

  const confirmDelete = (e: Entry) =>
    Alert.alert(
      e.kind === 'tape' ? 'Delete this measurement?' : 'Delete this weigh-in?',
      `${formatDateTime(e.takenAt)}\nIt is removed from this app. Anything already sent to Apple Health stays there.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteEntry(e) },
      ],
    );

  return (
    <FlatList
      contentContainerStyle={styles.container}
      data={entries}
      keyExtractor={(e) => e.id}
      ListEmptyComponent={
        <ThemedText subtle style={styles.empty}>
          Nothing saved yet.
        </ThemedText>
      }
      renderItem={({ item }) => {
        const s = summary(item, units);
        return (
          <Card style={styles.row}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.title}>{s.title}</ThemedText>
              <ThemedText subtle style={styles.detail}>
                {formatDateTime(item.takenAt)} · {s.detail}
              </ThemedText>
            </View>
            <Button title="Delete" variant="secondary" onPress={() => confirmDelete(item)} style={styles.delete} />
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 17, fontWeight: '600' },
  detail: { fontSize: 13 },
  delete: { flex: 0, paddingHorizontal: 14 },
  empty: { textAlign: 'center', paddingVertical: 40 },
});
