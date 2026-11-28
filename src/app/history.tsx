import { File, Paths } from 'expo-file-system';
import { useState } from 'react';
import { Alert, FlatList, Share, StyleSheet, View } from 'react-native';
import { bpContextOf, bpContextText, type BpArm, type BpPosition } from '@/domain/bloodPressure';
import { groupEntries, type Entry } from '@/storage/measurements';
import { deleteEntry, setBpContext, useMeasurements } from '@/storage/useMeasurements';
import { usePressureUnit, useUnits } from '@/storage/useSettings';
import { Button, Card } from '@/ui/components';
import { Segmented } from '@/ui/Segmented';
import { METRICS, metricById } from '@/ui/metrics';
import { ThemedText } from '@/ui/ThemedText';
import { measurementsToCsv } from '@/util/csv';
import { formatDateTime } from '@/util/format';
import { formatForDisplay, type PressureUnit, type UnitSystem } from '@/util/units';

const BP_DEF = { unit: 'mmHg', digits: 0 };

function summary(e: Entry, units: UnitSystem, pressure: PressureUnit): { title: string; detail: string } {
  if (e.kind === 'tape') {
    const m = e.measurements[0];
    const def = METRICS.find((d) => d.key.type === 'circumference' && d.key.site === m.site) ?? metricById('waist');
    const f = formatForDisplay(def, m.value, units);
    return { title: `${def.label} ${f.text} ${f.unit}`, detail: 'Tape measure' };
  }
  if (e.kind === 'blood-pressure') {
    const sys = e.measurements.find((m) => m.type === 'bp_systolic');
    const dia = e.measurements.find((m) => m.type === 'bp_diastolic');
    const pulse = e.measurements.find((m) => m.type === 'pulse');
    const notes = [
      pulse ? `Pulse ${Math.round(pulse.value)} bpm` : 'Blood pressure',
      bpContextText(bpContextOf(e.measurements)),
      e.measurements.some((m) => m.type === 'irregular_pulse') ? 'irregular pulse' : null,
      e.measurements.some((m) => m.type === 'body_movement') ? 'movement' : null,
    ].filter(Boolean);
    return {
      title: sys && dia ? `${formatForDisplay(BP_DEF, sys.value, units, pressure).text}/${formatForDisplay(BP_DEF, dia.value, units, pressure).text} ${pressure}` : 'Blood pressure',
      detail: notes.join(' · '),
    };
  }
  const weight = e.measurements.find((m) => m.type === 'weight');
  const fat = e.measurements.find((m) => m.type === 'body_fat');
  const w = weight ? formatForDisplay(metricById('weight'), weight.value, units) : null;
  return {
    title: w ? `${w.text} ${w.unit}` : 'Weigh-in',
    detail: fat ? `Body fat ${fat.value.toFixed(1)}%` : 'Weight only',
  };
}

/** Arm and position for one cuff reading. Edits here do not change what Apple Health already holds. */
function BpContextEditor({ entry }: { entry: Entry }) {
  const source = entry.measurements[0].source;
  const current = bpContextOf(entry.measurements);
  return (
    <View style={styles.editor}>
      <Segmented<BpArm | null>
        options={[
          { value: 'left', label: 'Left arm' },
          { value: 'right', label: 'Right arm' },
          { value: null, label: 'Not set' },
        ]}
        value={current.arm}
        onChange={(arm) => setBpContext(source, entry.takenAt, { ...current, arm })}
      />
      <Segmented<BpPosition | null>
        options={[
          { value: 'sitting', label: 'Sitting' },
          { value: 'standing', label: 'Standing' },
          { value: 'lying', label: 'Lying' },
          { value: null, label: 'Not set' },
        ]}
        value={current.position}
        onChange={(position) => setBpContext(source, entry.takenAt, { ...current, position })}
      />
      <ThemedText subtle style={styles.detail}>
        Readings already sent to Apple Health keep what they were sent with.
      </ThemedText>
    </View>
  );
}

export default function HistoryScreen() {
  const list = useMeasurements();
  const units = useUnits();
  const pressure = usePressureUnit();
  const entries = groupEntries(list);
  const [editing, setEditing] = useState<string | null>(null);

  const confirmDelete = (e: Entry) =>
    Alert.alert(
      e.kind === 'tape' ? 'Delete this measurement?' : e.kind === 'blood-pressure' ? 'Delete this reading?' : 'Delete this weigh-in?',
      `${formatDateTime(e.takenAt)}\nIt is removed from this app. Anything already sent to Apple Health stays there.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteEntry(e) },
      ],
    );

  const exportCsv = async () => {
    try {
      const f = new File(Paths.cache, 'keel-export.csv');
      if (f.exists) f.delete();
      f.create();
      f.writeSync(measurementsToCsv(list));
      await Share.share({ url: f.uri });
    } catch (e) {
      Alert.alert('Could not export', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
      data={entries}
      keyExtractor={(e) => e.id}
      ListHeaderComponent={
        entries.length > 0 ? <Button title="Export CSV" variant="secondary" onPress={() => void exportCsv()} /> : undefined
      }
      ListEmptyComponent={
        <ThemedText subtle style={styles.empty}>
          Nothing saved yet.
        </ThemedText>
      }
      renderItem={({ item }) => {
        const s = summary(item, units, pressure);
        return (
          <Card style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.title}>{s.title}</ThemedText>
                <ThemedText subtle style={styles.detail}>
                  {formatDateTime(item.takenAt)} · {s.detail}
                </ThemedText>
              </View>
              {item.kind === 'blood-pressure' && (
                <Button
                  title={editing === item.id ? 'Done' : 'Edit'}
                  variant="secondary"
                  onPress={() => setEditing(editing === item.id ? null : item.id)}
                  style={styles.delete}
                />
              )}
              <Button title="Delete" variant="secondary" onPress={() => confirmDelete(item)} style={styles.delete} />
            </View>
            {item.kind === 'blood-pressure' && editing === item.id && <BpContextEditor entry={item} />}
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10 },
  card: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  editor: { gap: 8 },
  title: { fontSize: 17, fontWeight: '600' },
  detail: { fontSize: 13 },
  delete: { flex: 0, paddingHorizontal: 14 },
  empty: { textAlign: 'center', paddingVertical: 40 },
});
