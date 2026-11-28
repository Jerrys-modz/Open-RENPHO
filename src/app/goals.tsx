import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import {
  DEFAULT_BP_TARGET,
  NO_GOALS,
  validateBpTarget,
  validateWeightGoal,
  type BpTarget,
} from '@/domain/goals';
import { latestWithDelta } from '@/storage/measurements';
import { saveGoals, useGoals } from '@/storage/useGoals';
import { useMeasurements } from '@/storage/useMeasurements';
import { useUnits } from '@/storage/useSettings';
import { Button, Card, SectionTitle } from '@/ui/components';
import { useColors } from '@/ui/theme';
import { ThemedText } from '@/ui/ThemedText';
import { formatForDisplay, parseWeightToKg, weightToInput } from '@/util/units';

export default function GoalsScreen() {
  const c = useColors();
  const goals = useGoals();
  const units = useUnits();
  const list = useMeasurements();
  const latestKg = latestWithDelta(list, { type: 'weight' })?.point.v ?? null;

  const [weight, setWeight] = useState(goals.weight ? weightToInput(goals.weight.targetKg, units) : '');
  const [bpOn, setBpOn] = useState(goals.bp !== null);
  const [sys, setSys] = useState(String((goals.bp ?? DEFAULT_BP_TARGET).systolic));
  const [dia, setDia] = useState(String((goals.bp ?? DEFAULT_BP_TARGET).diastolic));
  const [error, setError] = useState<string | null>(null);

  const input = [styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.background }];

  const save = () => {
    let next = { ...NO_GOALS };
    if (weight.trim() !== '') {
      const targetKg = parseWeightToKg(weight, units);
      // Progress is counted from the weight at the moment the goal is saved.
      const startKg = latestKg ?? NaN;
      const e = validateWeightGoal(targetKg, startKg);
      if (e) return setError(e);
      next = { ...next, weight: { targetKg, startKg } };
    }
    if (bpOn) {
      const t: BpTarget = { systolic: Number(sys), diastolic: Number(dia) };
      const e = validateBpTarget(t);
      if (e) return setError(e);
      next = { ...next, bp: t };
    }
    saveGoals(next);
    router.back();
  };

  const latest = latestKg === null ? null : formatForDisplay({ unit: 'kg', digits: 1 }, latestKg, units);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <ThemedText subtle style={styles.intro}>
        Goals stay on your phone and are never synced. Leave a goal empty to have none.
      </ThemedText>

      <SectionTitle>{units === 'imperial' ? 'Target weight (lb)' : 'Target weight (kg)'}</SectionTitle>
      <TextInput
        style={input}
        value={weight}
        onChangeText={setWeight}
        keyboardType="decimal-pad"
        placeholder={units === 'imperial' ? 'e.g. 160' : 'e.g. 72.5'}
        placeholderTextColor={c.subtext}
      />
      <ThemedText subtle style={styles.hint}>
        {latest
          ? `Progress is counted from your latest weight, ${latest.text} ${latest.unit}, when you save.`
          : 'Weigh in once first, so Keel can count your progress from today.'}
      </ThemedText>

      <SectionTitle>Blood pressure</SectionTitle>
      <Card style={styles.row}>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.title}>Track a blood-pressure target</ThemedText>
          <ThemedText subtle style={styles.hint}>
            Counts the readings in the last 30 days that are below it. The usual target for adults is below 130/80; ask your doctor
            what is right for you.
          </ThemedText>
        </View>
        <Switch value={bpOn} onValueChange={setBpOn} />
      </Card>
      {bpOn && (
        <View style={styles.pair}>
          <View style={{ flex: 1 }}>
            <ThemedText subtle style={styles.hint}>
              Systolic below (mmHg)
            </ThemedText>
            <TextInput style={input} value={sys} onChangeText={setSys} keyboardType="number-pad" maxLength={3} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText subtle style={styles.hint}>
              Diastolic below (mmHg)
            </ThemedText>
            <TextInput style={input} value={dia} onChangeText={setDia} keyboardType="number-pad" maxLength={3} />
          </View>
        </View>
      )}

      {error && <ThemedText style={{ color: c.danger }}>{error}</ThemedText>}
      <Button title="Save goals" onPress={save} style={styles.button} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  intro: { fontSize: 14 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, fontSize: 17 },
  hint: { fontSize: 13 },
  title: { fontSize: 17, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pair: { flexDirection: 'row', gap: 12 },
  button: { flex: 0, marginTop: 8 },
});
