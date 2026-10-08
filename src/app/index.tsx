import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function Home() {
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
