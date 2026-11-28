import { bpTargetShare, type BpTarget } from '@/domain/goals';
import type { BpReading } from '@/domain/bloodPressure';
import { StyleSheet } from 'react-native';
import { Card } from './components';
import { ProgressBar } from './GoalCard';
import { ThemedText } from './ThemedText';
import { useColors } from './theme';
import { formatForDisplay, type PressureUnit } from '@/util/units';

const BP_DEF = { unit: 'mmHg', digits: 0 };

/** How many of the last 30 days' readings were below the blood-pressure target. */
export function BpTargetCard({ readings, target, pressure }: { readings: readonly BpReading[]; target: BpTarget; pressure: PressureUnit }) {
  const c = useColors();
  const share = bpTargetShare(readings, target, 30);
  if (!share) return null;
  const fmt = (v: number) => formatForDisplay(BP_DEF, v, 'metric', pressure).text;
  return (
    <Card style={styles.card}>
      <ThemedText subtle style={styles.small}>
        Blood-pressure target: below {fmt(target.systolic)}/{fmt(target.diastolic)} {pressure}
      </ThemedText>
      <ThemedText style={styles.big}>
        {share.meeting} of {share.total} readings
      </ThemedText>
      <ProgressBar fraction={share.meeting / share.total} color={share.meeting === share.total ? '#43a047' : c.accent} />
      <ThemedText subtle style={styles.small}>
        in the 30 days up to your newest reading met the target. A goal for you to discuss with your doctor, not medical advice.
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8 },
  small: { fontSize: 13 },
  big: { fontSize: 20, fontWeight: '700' },
});
