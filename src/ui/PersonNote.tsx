import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { activePerson } from '@/domain/people';
import { usePeople } from '@/storage/usePeople';
import { ThemedText } from './ThemedText';
import { useColors } from './theme';

/** "Saving to Alex · Change", shown only when the phone has more than one person. Taps through to People. */
export function PersonNote({ prefix }: { prefix: string }) {
  const c = useColors();
  const people = usePeople();
  if (people.people.length < 2) return null;
  return (
    <Pressable onPress={() => router.push('/people')} accessibilityLabel="Change person" style={styles.row}>
      <View style={styles.row}>
        <ThemedText subtle style={styles.text}>
          {prefix}{' '}
        </ThemedText>
        <ThemedText style={styles.name}>{activePerson(people).name}</ThemedText>
        <ThemedText style={[styles.text, { color: c.accent }]}> · Change</ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { fontSize: 14 },
  name: { fontSize: 14, fontWeight: '700' },
});
