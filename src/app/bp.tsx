import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { readingToMeasurements } from '@/ble/ihealth/measurements';
import { CuffConnection } from '@/ble/ihealth/transport';
import { addMeasurements, useMeasurements } from '@/storage/useMeasurements';
import { usePressureUnit } from '@/storage/useSettings';
import { syncAppleHealth } from '@/sync';
import { Button, Card } from '@/ui/components';
import { ThemedText } from '@/ui/ThemedText';
import { formatDateTime } from '@/util/format';
import { formatForDisplay } from '@/util/units';

const BP_DEF = { unit: 'mmHg', digits: 0 };

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

  useEffect(() => () => void conn.current?.stop(), []);

  const latest = list
    .filter((m) => m.type === 'bp_systolic')
    .sort((a, b) => b.takenAt - a.takenAt)[0];
  const latestDia = latest && list.find((m) => m.type === 'bp_diastolic' && m.takenAt === latest.takenAt);

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
        addMeasurements(readings.flatMap(readingToMeasurements));
        void syncAppleHealth();
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
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.hero}>
        <ThemedText subtle>{status}</ThemedText>
        <ThemedText style={styles.value}>
          {latest && latestDia
            ? `${formatForDisplay(BP_DEF, latest.value, 'metric', pressure).text}/${formatForDisplay(BP_DEF, latestDia.value, 'metric', pressure).text}`
            : '--'}{' '}
          <ThemedText subtle style={styles.unit}>
            {pressure}
          </ThemedText>
        </ThemedText>
        {latest && <ThemedText subtle>{formatDateTime(latest.takenAt)}</ThemedText>}
        {battery !== null && <ThemedText subtle>Cuff battery {battery}%</ThemedText>}
      </Card>

      {result && <ThemedText>{result}</ThemedText>}
      {error && <ThemedText style={styles.error}>{error}</ThemedText>}

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
  error: { color: '#e53935' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hint: { fontSize: 13 },
});
