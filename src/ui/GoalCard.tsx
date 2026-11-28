import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { weightProgress, type WeightGoal } from '@/domain/goals';
import { formatForDisplay, type UnitSystem } from '@/util/units';
import { Card } from './components';
import { ThemedText } from './ThemedText';
import { useColors } from './theme';

const KG = { unit: 'kg', digits: 1 };

/** A thin progress bar. `fraction` is 0 to 1. */
export function ProgressBar({ fraction, color }: { fraction: number; color: string }) {
  const c = useColors();
  return (
    <View style={[styles.track, { backgroundColor: c.chipOff }]}>
      <View style={[styles.fill, { backgroundColor: color, width: `${Math.round(fraction * 100)}%` }]} />
    </View>
  );
}

/** The weight goal on the Overview: progress from the weight you set it at, and how far is left. Taps through to Goals. */
export function GoalCard({ goal, currentKg, units }: { goal: WeightGoal; currentKg: number; units: UnitSystem }) {
  const c = useColors();
  const p = weightProgress(goal, currentKg);
  const target = formatForDisplay(KG, goal.targetKg, units);
  const left = formatForDisplay(KG, p.remainingKg, units);
  return (
    <Pressable onPress={() => router.push('/goals')} accessibilityLabel="Goals">
      <Card style={styles.card}>
        <View style={styles.row}>
          <ThemedText subtle style={styles.small}>
            Goal weight
          </ThemedText>
          <ThemedText style={styles.target}>
            {target.text} {target.unit}
          </ThemedText>
        </View>
        <ProgressBar fraction={p.fraction} color={p.reached ? '#43a047' : c.accent} />
        <ThemedText subtle style={styles.small}>
          {p.reached ? 'Goal reached' : `${left.text} ${left.unit} to ${p.direction === 'lose' ? 'lose' : 'gain'} · ${Math.round(p.fraction * 100)}% of the way`}
        </ThemedText>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  small: { fontSize: 13 },
  target: { fontSize: 20, fontWeight: '700' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
});
