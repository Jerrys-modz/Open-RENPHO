import { useTheme } from 'expo-router';
import { Text, type TextProps } from 'react-native';

/** Text that follows the navigation theme (light or dark). */
export function ThemedText({ style, ...rest }: TextProps) {
  const { colors } = useTheme();
  return <Text {...rest} style={[{ color: colors.text }, style]} />;
}
