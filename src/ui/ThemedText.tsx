import { Text, type TextProps } from 'react-native';
import { useColors } from './theme';

/** Text that follows the light/dark palette. Pass `subtle` for secondary text. */
export function ThemedText({ style, subtle, ...rest }: TextProps & { subtle?: boolean }) {
  const c = useColors();
  return <Text {...rest} style={[{ color: subtle ? c.subtext : c.text }, style]} />;
}
