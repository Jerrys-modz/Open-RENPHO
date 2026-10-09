import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { isAppleHealthAvailable, requestAppleHealthAccess } from '@/sync/appleHealth';
import { syncAppleHealth, syncSparky } from '@/sync';
import { checkConnection, normalizeServerUrl } from '@/sync/sparkyClient';
import { clearSparkyKey, loadSparkyKey, saveSparkyKey } from '@/storage/sparkyKey';
import { setAppleHealthEnabled, updateSparky, useSyncState } from '@/storage/useSyncState';
import { Button, Card, SectionTitle } from '@/ui/components';
import { useColors } from '@/ui/theme';
import { ThemedText } from '@/ui/ThemedText';

export default function SyncScreen() {
  const c = useColors();
  const { appleHealth, sparky } = useSyncState();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [url, setUrl] = useState(sparky.serverUrl);
  const [key, setKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [sparkyMessage, setSparkyMessage] = useState<string | null>(null);

  useEffect(() => {
    void isAppleHealthAvailable().then(setAvailable);
    void loadSparkyKey().then((k) => setHasKey(!!k));
  }, []);

  const connectSparky = async () => {
    const serverUrl = normalizeServerUrl(url);
    const apiKey = key.trim() || (await loadSparkyKey()) || '';
    if (!serverUrl) return setSparkyMessage('Enter your SparkyFitness server address, like https://sparky.example.com.');
    if (!apiKey) return setSparkyMessage('Paste an API key from SparkyFitness (Settings, API keys).');
    setBusy(true);
    setSparkyMessage('Checking…');
    const check = await checkConnection(serverUrl, apiKey);
    if (!check.ok) {
      setBusy(false);
      return setSparkyMessage(check.message);
    }
    await saveSparkyKey(apiKey);
    setHasKey(true);
    setKey('');
    setUrl(serverUrl);
    updateSparky({ serverUrl, enabled: true, lastProblem: null });
    const r = await syncSparky();
    setBusy(false);
    setSparkyMessage(describeSparky(r.written, r.failed, r.problem));
  };

  const runSparky = async () => {
    setBusy(true);
    const r = await syncSparky();
    setBusy(false);
    setSparkyMessage(describeSparky(r.written, r.failed, r.problem));
  };

  const disconnectSparky = async () => {
    await clearSparkyKey();
    setHasKey(false);
    setKey('');
    updateSparky({ enabled: false, lastProblem: null });
    setSparkyMessage('Disconnected. Your saved readings are unchanged.');
  };

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

      <SectionTitle>SparkyFitness</SectionTitle>
      <ThemedText subtle style={styles.text}>
        Sends to your own SparkyFitness server over its API. In SparkyFitness, create an API key in Settings with the
        health_data_write permission. The key is stored in the iOS keychain on this phone.
      </ThemedText>
      <TextInput
        style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.background }]}
        value={url}
        onChangeText={setUrl}
        placeholder="https://sparky.example.com"
        placeholderTextColor={c.subtext}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        editable={!busy}
      />
      <TextInput
        style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.background }]}
        value={key}
        onChangeText={setKey}
        placeholder={hasKey ? 'API key saved (paste a new one to replace it)' : 'API key'}
        placeholderTextColor={c.subtext}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        editable={!busy}
      />
      <Button
        title={sparky.enabled ? 'Save and test' : 'Connect'}
        onPress={() => void connectSparky()}
        disabled={busy}
        style={styles.button}
      />
      {sparky.enabled && (
        <>
          <Card style={styles.row}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.title}>Also send extra metrics</ThemedText>
              <ThemedText subtle style={styles.text}>
                BMI, fat-free mass, skeletal muscle, protein and impedance, as custom measurements.
              </ThemedText>
            </View>
            <Switch value={sparky.includeExtras} onValueChange={(v) => updateSparky({ includeExtras: v })} disabled={busy} />
          </Card>
          <ThemedText subtle style={styles.text}>
            Sent: weight, body fat, muscle mass, bone mass, water %, BMR, and waist, hips and neck (other tape sites as custom
            measurements). SparkyFitness keeps one value per day for each, so the last weigh-in of a day wins.
          </ThemedText>
          <Button title={busy ? 'Syncing…' : 'Sync now'} onPress={() => void runSparky()} disabled={busy} style={styles.button} />
          <Button title="Disconnect" variant="secondary" onPress={() => void disconnectSparky()} disabled={busy} style={styles.button} />
          <ThemedText subtle style={[styles.text, { textAlign: 'center' }]}>
            {sparky.lastSyncAt ? `Last sync ${new Date(sparky.lastSyncAt).toLocaleString()}` : 'Not synced yet'}
          </ThemedText>
          {sparky.lastProblem && <ThemedText style={{ color: c.danger, textAlign: 'center' }}>{sparky.lastProblem}</ThemedText>}
        </>
      )}
      {sparkyMessage && <ThemedText style={{ color: c.subtext, textAlign: 'center' }}>{sparkyMessage}</ThemedText>}
    </ScrollView>
  );
}

function describeSparky(written: number, failed: number, problem?: string): string {
  if (problem) return problem;
  if (failed > 0) return `Sent ${written}, ${failed} failed.`;
  return written > 0 ? `Sent ${written} reading${written === 1 ? '' : 's'} to SparkyFitness.` : 'Everything is already in SparkyFitness.';
}

const styles = StyleSheet.create({
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, fontSize: 17 },
  container: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 17, fontWeight: '600' },
  text: { fontSize: 13, lineHeight: 18 },
  button: { flex: 0 },
});
