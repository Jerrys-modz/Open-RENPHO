import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { isAppleHealthAvailable, requestAppleHealthAccess } from '@/sync/appleHealth';
import { syncAppleHealth } from '@/sync';
import { setAppleHealthEnabled, useSyncState } from '@/storage/useSyncState';
import { Button, Card, SectionTitle } from '@/ui/components';
import { useColors } from '@/ui/theme';
import { ThemedText } from '@/ui/ThemedText';

export default function SyncScreen() {
  const c = useColors();
  const { appleHealth } = useSyncState();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void isAppleHealthAvailable().then(setAvailable);
  }, []);

  const run = async () => {
    setBusy(true);
    const r = await syncAppleHealth();
    setBusy(false);
    setMessage(
      r.failed > 0
        ? `Sent ${r.written}, ${r.failed} failed. Check Health access in Settings.`
        : r.written > 0
          ? `Sent ${r.written} reading${r.written === 1 ? '' : 's'} to Apple Health.`
          : 'Everything is already in Apple Health.',
    );
  };

  const toggle = async (on: boolean) => {
    if (!on) {
      setAppleHealthEnabled(false);
      return;
    }
    setBusy(true);
    const ok = await requestAppleHealthAccess();
    setBusy(false);
    if (!ok) {
      setMessage('Apple Health did not grant access. You can change this in Settings > Health > Data Access.');
      return;
    }
    setAppleHealthEnabled(true);
    await run();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <SectionTitle>Apple Health</SectionTitle>
      <Card style={styles.row}>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.title}>Send readings to Apple Health</ThemedText>
          <ThemedText subtle style={styles.text}>
            {available === false
              ? 'Apple Health is not available on this device.'
              : 'New weigh-ins and waist measurements are written automatically. Nothing is read back.'}
          </ThemedText>
        </View>
        <Switch
          value={appleHealth.enabled}
          onValueChange={(v) => void toggle(v)}
          disabled={busy || available === false}
        />
      </Card>

      <ThemedText subtle style={styles.text}>
        Sent: weight, body fat, lean (fat-free) mass, BMI and waist. Water, bone, protein, BMR and the other tape sites have no
        Apple Health type, so they stay in this app.
      </ThemedText>

      {appleHealth.enabled && (
        <>
          <Button title={busy ? 'Syncing…' : 'Sync now'} onPress={() => void run()} disabled={busy} style={styles.button} />
          <ThemedText subtle style={[styles.text, { textAlign: 'center' }]}>
            {appleHealth.lastSyncAt ? `Last sync ${new Date(appleHealth.lastSyncAt).toLocaleString()}` : 'Not synced yet'}
          </ThemedText>
        </>
      )}
      {message && <ThemedText style={{ color: c.subtext, textAlign: 'center' }}>{message}</ThemedText>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 17, fontWeight: '600' },
  text: { fontSize: 13, lineHeight: 18 },
  button: { flex: 0 },
});
