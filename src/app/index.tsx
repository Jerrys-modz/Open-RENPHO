import { Link, Redirect } from 'expo-router';
import { readDemoMode } from '@/demo';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function Home() {
  // CI screenshots: a demo-mode file picks the screen to open (see src/demo.ts).
  const [demo] = useState(readDemoMode);
  if (demo === 'scale' || demo === 'tape') return <Redirect href={demo === 'scale' ? '/scale' : '/tape'} />;
  return (
    <View style={styles.container}>
      <Link href="/scale" style={styles.link}>
        Weigh in (scale)
      </Link>
      <Link href="/tape" style={styles.link}>
        Tape measure
      </Link>
      <Text style={styles.note}>Bluetooth only works in a development build, not Expo Go.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 24, justifyContent: 'center' },
  link: { fontSize: 22, fontWeight: '600', textAlign: 'center', padding: 16 },
  note: { textAlign: 'center', opacity: 0.6 },
});
