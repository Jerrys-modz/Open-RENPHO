import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { CaptureScanner } from '@/ble/aabb/captureScanner';
import { buildReport, hexToBytes } from '@/ble/aabb/recorder';
import { DEMO_CAPTURE_FRAMES, readDemoMode } from '@/demo';
import { Button, Card, SectionTitle } from '@/ui/components';
import { useColors } from '@/ui/theme';
import { ThemedText } from '@/ui/ThemedText';

const LABELS = ['Nothing on scale', 'Barefoot', 'Socks', 'Wet feet', 'Shoes'] as const;

const hex2 = (n: number) => n.toString(16).padStart(2, '0');

export default function CaptureScreen() {
  const c = useColors();
  const [demo] = useState(() => readDemoMode() === 'capture');
  const [label, setLabel] = useState<string>(demo ? 'Barefoot' : LABELS[1]);
  const [status, setStatus] = useState(demo ? 'Stopped' : 'Ready');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [stoppedAt, setStoppedAt] = useState<number | null>(demo ? 12_000 : null);

  const [sc] = useState(() => {
    const scanner = new CaptureScanner();
    if (demo) {
      scanner.mac = 'ed:67:39:53:49:85';
      scanner.startedAt = Date.now() - 12_000;
      DEMO_CAPTURE_FRAMES.forEach(([t, h]) => scanner.recorder.add(hexToBytes(h), t));
    }
    return scanner;
  });

  // Re-read the recorder a few times a second instead of re-rendering on every packet.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((n) => n + 1), 300);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => () => sc.stop(), [sc]);

  const start = () => {
    setError(null);
    setStoppedAt(null);
    setRunning(true);
    sc.start(setStatus, (m) => {
      setError(m);
      setStatus('Something went wrong');
      setRunning(false);
    });
  };

  const stop = () => {
    sc.stop();
    setStoppedAt(Date.now() - sc.startedAt);
    setRunning(false);
    setStatus('Stopped');
  };

  const share = () => {
    const text = buildReport(sc.recorder, {
      label,
      startedAt: new Date(sc.startedAt || Date.now()),
      durationMs: stoppedAt ?? Date.now() - sc.startedAt,
      mac: sc.mac,
      otherScaleFrames: sc.otherScaleFrames,
    });
    void Share.share({ message: text });
  };

  const rec = sc.recorder;
  const last = rec.transitions().at(-1);
  const varied = rec.variedBytes();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText subtle style={styles.intro}>
        For the broadcast-only scale. It records every packet the scale sends during a weigh-in so we can see which bytes
        change with what you do, for example whether anything reacts to bare feet versus socks. Nothing is sent anywhere
        until you tap Share.
      </ThemedText>

      <SectionTitle>What are you doing?</SectionTitle>
      <View style={styles.chips}>
        {LABELS.map((l) => (
          <Pressable
            key={l}
            disabled={running}
            onPress={() => setLabel(l)}
            style={[styles.chip, { borderColor: c.border, backgroundColor: l === label ? c.accent : c.card, opacity: running ? 0.5 : 1 }]}
          >
            <ThemedText style={{ color: l === label ? c.accentText : c.text, fontWeight: '600' }}>{l}</ThemedText>
          </Pressable>
        ))}
      </View>

      <Button title={running ? 'Stop' : rec.total > 0 ? 'Record again' : 'Start recording'} onPress={running ? stop : start} style={styles.button} />
      <ThemedText subtle style={styles.status}>
        {status}
      </ThemedText>
      {error && <ThemedText style={{ color: c.danger, textAlign: 'center' }}>{error}</ThemedText>}

      <Card>
        <Row k="Scale" v={sc.mac ?? 'none seen yet'} />
        <Row k="Packets" v={`${rec.total}  (${rec.distinct} different)`} />
        <Row
          k="Latest"
          v={last ? `status ${hex2(last.status)}, ${last.weightKg.toFixed(2)} kg` : '--'}
        />
        <Row k="Bytes that change" v={varied.length ? varied.join(', ') : '--'} />
        <Row k="Impedance bytes (19-20)" v={rec.byteVariation()[19]?.values.length > 1 ? 'CHANGING' : 'constant'} />
      </Card>

      <Button title="Share report" variant="secondary" onPress={share} style={styles.button} />
      <ThemedText subtle style={styles.hint}>
        Plan: record Nothing on scale, then Barefoot, then Socks. Stay on for about 15 seconds each time and share each report
        with the developer.
      </ThemedText>
    </ScrollView>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.row}>
      <ThemedText subtle>{k}</ThemedText>
      <ThemedText style={styles.rowValue}>{v}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  intro: { fontSize: 14, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  button: { flex: 0 },
  status: { textAlign: 'center' },
  hint: { textAlign: 'center', fontSize: 13 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowValue: { fontWeight: '600', flexShrink: 1, textAlign: 'right' },
});
