import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { importedMeasurements } from '@/ble/ihealth/measurements';
import { CuffConnection } from '@/ble/ihealth/transport';
import { addMeasurements, getMeasurements, useMeasurements } from '@/storage/useMeasurements';
import { getBpDefaults, setBpDefaults, useBpDefaults, usePressureUnit, useUnits } from '@/storage/useSettings';
import { syncAll } from '@/sync';
import { BP_CATEGORY_COLOR, BP_CATEGORY_LABEL, bpReadings, classifyBp, readingsInWindow } from '@/domain/bloodPressure';
import { BloodPressureChart } from '@/ui/BloodPressureChart';
import { BpTargetCard } from '@/ui/BpTargetCard';
import { useGoals } from '@/storage/useGoals';
import { BloodPressureSummary } from '@/ui/BloodPressureSummary';
import { Button, Card } from '@/ui/components';
import { Segmented } from '@/ui/Segmented';
import { ThemedText } from '@/ui/ThemedText';
import { shareBpReport } from '@/util/shareBpReport';
import { formatDateTime } from '@/util/format';
import { formatForDisplay } from '@/util/units';

const BP_DEF = { unit: 'mmHg', digits: 0 };

const RANGES = [
  { value: '7', label: '7 days', days: 7, text: 'Last 7 days' },
  { value: '30', label: '30 days', days: 30, text: 'Last 30 days' },
  { value: '90', label: '90 days', days: 90, text: 'Last 90 days' },
  { value: 'all', label: 'All', days: null, text: 'All readings' },
] as const;

export default function BloodPressureScreen() {
  const conn = useRef<CuffConnection | null>(null);
  const list = useMeasurements();
  const pressure = usePressureUnit();
  const [status, setStatus] = useState('Ready');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [battery, setBattery] = useState<number | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [clearCuff, setClearCuff] = useState(false);
  const [range, setRange] = useState<(typeof RANGES)[number]['value']>('30');
  const [sharing, setSharing] = useState(false);

  useEffect(() => () => void conn.current?.stop(), []);

  const readings = bpReadings(list);
  const latest = readings[0];
  const units = useUnits();
  const defaults = useBpDefaults();
  const goals = useGoals();

  const chosen = RANGES.find((r) => r.value === range) ?? RANGES[1];
  const inRange = readingsInWindow(readings, chosen.days);

  const shareReport = async () => {
    setSharing(true);
    try {
      await shareBpReport(inRange, pressure, chosen.text);
    } catch (e) {
      Alert.alert('Could not make the report', e instanceof Error ? e.message : String(e));
    } finally {
      setSharing(false);
    }
  };

  const chosen = RANGES.find((r) => r.value === range) ?? RANGES[1];
  const inRange = readingsInWindow(readings, chosen.days);

  const shareReport = async () => {
    setSharing(true);
    try {
      await shareBpReport(inRange, pressure, chosen.text);
    } catch (e) {
      Alert.alert('Could not make the report', e instanceof Error ? e.message : String(e));
    } finally {
      setSharing(false);
    }
  };

  const begin = () => {
    void conn.current?.stop();
    conn.current = new CuffConnection();
    setBusy(true);
    setError(null);
    setResult(null);
    conn.current.start({
      deleteAfterImport: clearCuff,
      onStatus: setStatus,
      onBattery: setBattery,
      onReadings: (readings) => {
        addMeasurements(importedMeasurements(getMeasurements(), readings, getBpDefaults()));
        void syncAll();
      },
      onDone: ({ imported, deleted }) => {
        setBusy(false);
        setStatus('Done');
        setResult(
          imported === 0
            ? 'No stored readings on the cuff.'
            : `Imported ${imported} reading${imported === 1 ? '' : 's'}${deleted ? ' and cleared them from the cuff' : ''}.`,
        );
      },
      onError: (m) => {
        setBusy(false);
        setError(m);
        setStatus('Something went wrong');
      },
    });
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.container}>
      <Card style={styles.hero}>
        <ThemedText subtle>{status}</ThemedText>
        <ThemedText style={styles.value}>
          {latest
            ? `${formatForDisplay(BP_DEF, latest.systolic, units, pressure).text}/${formatForDisplay(BP_DEF, latest.diastolic, units, pressure).text}`
            : '--'}{' '}
          <ThemedText subtle style={styles.unit}>
            {pressure}
          </ThemedText>
        </ThemedText>
        {latest && (
          <ThemedText
            style={[styles.category, { color: BP_CATEGORY_COLOR[classifyBp(latest.systolic, latest.diastolic)] }]}
          >
            {BP_CATEGORY_LABEL[classifyBp(latest.systolic, latest.diastolic)]}
          </ThemedText>
        )}
        {latest && <ThemedText subtle>{formatDateTime(latest.takenAt)}</ThemedText>}
        {battery !== null && <ThemedText subtle>Cuff battery {battery}%</ThemedText>}
      </Card>

      {readings.length > 0 && (
        <Card style={styles.defaults}>
          <Segmented
            options={RANGES.map((r) => ({ value: r.value, label: r.label }))}
            value={range}
            onChange={setRange}
          />
          <BloodPressureChart readings={inRange} pressure={pressure} />
          <Button
            title={sharing ? 'Making report…' : 'Share report for your doctor'}
            variant="secondary"
            onPress={() => void shareReport()}
            disabled={sharing || inRange.length === 0}
          />
          <ThemedText subtle style={styles.hint}>
            A PDF with averages, extremes and every reading in the chosen period. Covers the same days as the chart.
          </ThemedText>
        </Card>
      )}

      <BloodPressureSummary readings={readings} units={units} pressure={pressure} showLatest={false} showTimeOfDay />
      {goals.bp && <BpTargetCard readings={readings} target={goals.bp} pressure={pressure} />}

      {result && <ThemedText>{result}</ThemedText>}
      {error && <ThemedText style={styles.error}>{error}</ThemedText>}

      <Card style={styles.defaults}>
        <ThemedText>How you usually measure</ThemedText>
        <ThemedText subtle style={styles.hint}>
          Applied to the new readings each sync imports. Change a saved reading in History.
        </ThemedText>
        <ThemedText subtle style={styles.hint}>
          Arm
        </ThemedText>
        <Segmented
          options={[
            { value: 'left', label: 'Left' },
            { value: 'right', label: 'Right' },
            { value: null, label: 'Not set' },
          ]}
          value={defaults.arm}
          onChange={(arm) => setBpDefaults({ arm })}
          disabled={busy}
        />
        <ThemedText subtle style={styles.hint}>
          Position
        </ThemedText>
        <Segmented
          options={[
            { value: 'sitting', label: 'Sitting' },
            { value: 'standing', label: 'Standing' },
            { value: 'lying', label: 'Lying' },
            { value: 'reclining', label: 'Reclining' },
            { value: null, label: 'Not set' },
          ]}
          value={defaults.position}
          onChange={(position) => setBpDefaults({ position })}
          disabled={busy}
        />
      </Card>

      <Card style={styles.toggle}>
        <View style={{ flex: 1 }}>
          <ThemedText>Clear the cuff after importing</ThemedText>
          <ThemedText subtle style={styles.hint}>
            Off keeps readings on the cuff (it holds 99). Repeats are never saved twice. When on, the cuff is only cleared after
            every reading has been downloaded and saved here.
          </ThemedText>
        </View>
        <Switch value={clearCuff} onValueChange={setClearCuff} disabled={busy} />
      </Card>

      <Button title={busy ? 'Syncing…' : 'Sync from cuff'} onPress={begin} disabled={busy} />
      <ThemedText subtle style={styles.hint}>
        Take a measurement, then press the cuff&apos;s Bluetooth button and tap Sync. The KN-550BT is only visible for about ten
        seconds.
      </ThemedText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  hero: { alignItems: 'center', gap: 4 },
  value: { fontSize: 44, fontWeight: '700' },
  unit: { fontSize: 18, fontWeight: '400' },
  category: { fontSize: 15, fontWeight: '700' },
  error: { color: '#e53935' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  defaults: { gap: 8 },
  hint: { fontSize: 13 },
});
