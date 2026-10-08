import { Link, Redirect, useTheme } from 'expo-router';
import { readDemoMode } from '@/demo';
import { useState } from 'react';
import { ThemedText } from '@/ui/ThemedText';
import { StyleSheet, View } from 'react-native';

export default function Home() {
  const { colors } = useTheme();
  // CI screenshots: a demo-mode file picks the screen to open (see src/demo.ts).
  const [demo] = useState(readDemoMode);
  if (demo === 'scale' || demo === 'tape') return <Redirect href={demo === 'scale' ? '/scale' : '/tape'} />;
  return (
    <View style={styles.container}>
      <Link href="/scale" style={[styles.link, { color: colors.text }]}>
        Weigh in (scale)
      </Link>
      <Link href="/tape" style={[styles.link, { color: colors.text }]}>
        Tape measure
      </Link>
      <ThemedText style={styles.note}>Bluetooth only works in a development build, not Expo Go.</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 24, justifyContent: 'center' },
  link: { fontSize: 22, fontWeight: '600', textAlign: 'center', padding: 16 },
  note: { textAlign: 'center', opacity: 0.6 },
});
