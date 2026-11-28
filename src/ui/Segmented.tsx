import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { useColors } from './theme';

export interface SegmentOption<T extends string | null> {
  value: T;
  label: string;
}

/** A row of mutually exclusive choices, in the same style as the profile screen's selectors. */
export function Segmented<T extends string | null>({
  options,
  value,
  onChange,
  disabled = false,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const c = useColors();
  return (
    <View style={styles.row}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            disabled={disabled}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on, disabled }}
            style={[styles.item, { borderColor: c.border, backgroundColor: on ? c.accent : c.card, opacity: disabled ? 0.5 : 1 }]}
          >
            <ThemedText style={{ color: on ? c.accentText : c.text, fontWeight: '600', fontSize: 14 }}>{o.label}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  item: {
    flexGrow: 1,
    flexBasis: '30%',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
