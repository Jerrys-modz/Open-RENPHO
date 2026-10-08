import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { validateProfile, type Sex } from '@/domain/profile';
import { saveProfile, useProfile } from '@/storage/useProfile';
import { Button, Card, SectionTitle } from '@/ui/components';
import { useColors } from '@/ui/theme';
import { ThemedText } from '@/ui/ThemedText';

export default function ProfileScreen() {
  const c = useColors();
  const existing = useProfile();
  const [sex, setSex] = useState<Sex>(existing?.sex ?? 'male');
  const [birthDate, setBirthDate] = useState(existing?.birthDate ?? '');
  const [height, setHeight] = useState(existing ? String(existing.heightCm) : '');
  const [athlete, setAthlete] = useState(existing?.athlete ?? false);
  const [errors, setErrors] = useState<string[]>([]);

  const save = () => {
    const r = validateProfile({ sex, birthDate, heightCm: height, athlete });
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    setErrors([]);
    saveProfile(r.profile);
    router.back();
  };

  const input = [styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.background }];

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <ThemedText subtle style={styles.intro}>
        Your scale only measures weight and impedance. Body fat and everything derived from it (BMI, water, muscle, bone,
        BMR) is calculated from your sex, age and height. This stays on your phone.
      </ThemedText>

      <SectionTitle>Sex</SectionTitle>
      <View style={styles.segment}>
        {(['male', 'female'] as const).map((s) => (
          <Pressable
            key={s}
            onPress={() => setSex(s)}
            style={[styles.segmentItem, { borderColor: c.border, backgroundColor: s === sex ? c.accent : c.card }]}
          >
            <ThemedText style={{ color: s === sex ? c.accentText : c.text, fontWeight: '600' }}>
              {s === 'male' ? 'Male' : 'Female'}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <SectionTitle>Birth date</SectionTitle>
      <TextInput
        style={input}
        value={birthDate}
        onChangeText={setBirthDate}
        placeholder="YYYY-MM-DD, e.g. 1990-04-23"
        placeholderTextColor={c.subtext}
        keyboardType="numbers-and-punctuation"
        autoCorrect={false}
        maxLength={10}
      />

      <SectionTitle>Height (cm)</SectionTitle>
      <TextInput
        style={input}
        value={height}
        onChangeText={setHeight}
        placeholder="e.g. 178"
        placeholderTextColor={c.subtext}
        keyboardType="decimal-pad"
      />

      <Card style={styles.athlete}>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.athleteTitle}>Athlete mode</ThemedText>
          <ThemedText subtle style={styles.athleteText}>
            Uses a different body fat curve. Turn on if you train hard and have a lean build.
          </ThemedText>
        </View>
        <Switch value={athlete} onValueChange={setAthlete} />
      </Card>

      {errors.map((e) => (
        <ThemedText key={e} style={{ color: c.danger }}>
          {e}
        </ThemedText>
      ))}

      <Button title="Save profile" onPress={save} style={styles.button} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10 },
  intro: { fontSize: 14, lineHeight: 20, marginBottom: 6 },
  segment: { flexDirection: 'row', gap: 10 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, fontSize: 17 },
  athlete: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  athleteTitle: { fontSize: 17, fontWeight: '600' },
  athleteText: { fontSize: 13 },
  button: { flex: 0, marginTop: 8 },
});
