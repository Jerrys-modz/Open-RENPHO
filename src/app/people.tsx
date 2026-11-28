import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { PRIMARY_PERSON } from '@/domain/people';
import { addPersonByName, removePersonAndData, renamePersonTo, switchToPerson } from '@/storage/personActions';
import { usePeople } from '@/storage/usePeople';
import { Button, Card, SectionTitle } from '@/ui/components';
import { ThemedText } from '@/ui/ThemedText';

export default function PeopleScreen() {
  const { people, activeId } = usePeople();

  const ask = (title: string, message: string, initial: string | undefined, apply: (name: string) => string | null) =>
    Alert.prompt(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: (name?: string) => {
            const error = apply(name ?? '');
            if (error) Alert.alert('Could not save', error);
          },
        },
      ],
      'plain-text',
      initial,
    );

  const confirmRemove = (id: string, name: string) =>
    Alert.alert(
      `Remove ${name}?`,
      `This deletes ${name}'s readings, profile and goals from this phone. It cannot be undone, and anything already sent to Apple Health or SparkyFitness is not touched (only the first person's readings are ever sent).`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removePersonAndData(id) },
      ],
    );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText subtle style={styles.intro}>
        Everyone who uses this phone gets their own readings, profile, goals and Beurer scale slot. Switch to a person before weighing
        in, measuring or syncing the cuff: new readings go to whoever is active.
      </ThemedText>

      <SectionTitle>People</SectionTitle>
      {people.map((p) => (
        <Card key={p.id} style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.name}>{p.name}</ThemedText>
              <ThemedText subtle style={styles.hint}>
                {p.id === activeId ? 'Active' : p.id === PRIMARY_PERSON ? 'First person' : ' '}
                {p.id === activeId && p.id === PRIMARY_PERSON ? ' · first person' : ''}
              </ThemedText>
            </View>
            {p.id !== activeId && <Button title="Switch" variant="secondary" onPress={() => switchToPerson(p.id)} style={styles.small} />}
          </View>
          <View style={styles.row}>
            <Button
              title="Rename"
              variant="secondary"
              onPress={() => ask('Rename', 'Their name', p.name, (name) => renamePersonTo(p.id, name))}
              style={styles.small}
            />
            {p.id !== PRIMARY_PERSON && (
              <Button title="Remove" variant="secondary" onPress={() => confirmRemove(p.id, p.name)} style={styles.small} />
            )}
          </View>
        </Card>
      ))}

      <Button title="Add person" onPress={() => ask('Add person', 'Their name', undefined, addPersonByName)} />

      <ThemedText subtle style={styles.hint}>
        Only {people[0].name}&apos;s readings are sent to Apple Health and SparkyFitness, because those are one person&apos;s
        accounts. Everyone else&apos;s stay on this phone, and can still be exported from History.
      </ThemedText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  intro: { fontSize: 14 },
  card: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 17, fontWeight: '600' },
  hint: { fontSize: 13 },
  small: { flex: 0, paddingHorizontal: 14 },
});
