import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { MetricDef } from './metrics';
import { ThemedText } from './ThemedText';
import { useColors } from './theme';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[styles.card, { backgroundColor: c.card }, style]}>{children}</View>;
}

/** Round, colour-coded metric icon (grey when `active` is false), as in openScale. */
export function MetricIcon({
  def,
  size = 44,
  active = true,
  selected = false,
}: {
  def: MetricDef;
  size?: number;
  active?: boolean;
  /** Draws a ring around the icon, for the currently chosen chip. */
  selected?: boolean;
}) {
  const c = useColors();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? def.color : c.chipOff,
        borderWidth: 3,
        borderColor: selected ? c.text : 'transparent',
      }}
    >
      <SymbolView
        name={def.symbol as never}
        size={size * 0.46}
        tintColor={active ? '#ffffff' : c.subtext}
        fallback={<ThemedText style={{ fontSize: size * 0.4 }}>•</ThemedText>}
      />
    </View>
  );
}

export function MetricRow({
  def,
  value,
  delta,
  caption,
  unit,
}: {
  def: MetricDef;
  value: string;
  delta?: string | null;
  caption?: string;
  /** Overrides the metric's own unit, for converted values. */
  unit?: string;
}) {
  return (
    <View style={styles.row}>
      <MetricIcon def={def} />
      <View style={styles.rowText}>
        <ThemedText style={styles.rowLabel}>{def.label}</ThemedText>
        {(delta || caption) && (
          <ThemedText subtle style={styles.rowSub}>
            {[delta, caption].filter(Boolean).join('  ·  ')}
          </ThemedText>
        )}
      </View>
      <ThemedText style={styles.rowValue}>
        {value}{(unit ?? def.unit) !== '' && ' '}<ThemedText subtle style={styles.rowUnit}>{unit ?? def.unit}</ThemedText>
      </ThemedText>
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <ThemedText subtle style={styles.section}>
      {children}
    </ThemedText>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: primary ? c.accent : c.card, borderColor: c.border, opacity: pressed ? 0.8 : 1 },
        primary ? null : styles.buttonBordered,
        style,
      ]}
    >
      <ThemedText style={[styles.buttonText, { color: primary ? c.accentText : c.accent }]}>{title}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 17, fontWeight: '600' },
  rowSub: { fontSize: 13 },
  rowValue: { fontSize: 20, fontWeight: '600' },
  rowUnit: { fontSize: 14, fontWeight: '400' },
  section: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginLeft: 4 },
  button: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  buttonBordered: { borderWidth: StyleSheet.hairlineWidth },
  buttonText: { fontSize: 17, fontWeight: '600' },
});
