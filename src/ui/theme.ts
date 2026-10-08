import { DarkTheme, DefaultTheme } from 'expo-router';
import { useColorScheme, type ColorSchemeName } from 'react-native';

export interface Palette {
  background: string;
  card: string;
  text: string;
  subtext: string;
  border: string;
  accent: string;
  accentText: string;
  chipOff: string;
  danger: string;
}

const LIGHT: Palette = {
  background: '#f2f3f5',
  card: '#ffffff',
  text: '#111418',
  subtext: '#6b7280',
  border: '#e3e5e8',
  accent: '#0a84ff',
  accentText: '#ffffff',
  chipOff: '#d6d9de',
  danger: '#d92d20',
};

// Close to openScale's dark theme: near-black page, slightly lighter cards.
const DARK: Palette = {
  background: '#0e1215',
  card: '#1e2328',
  text: '#f1f3f4',
  subtext: '#9aa3ab',
  border: '#2c3238',
  accent: '#3d9bff',
  accentText: '#0b0f12',
  chipOff: '#3a4047',
  danger: '#ff6b5e',
};

export const palette = (scheme: ColorSchemeName): Palette =>
  scheme === 'dark' ? DARK : LIGHT;

export function useColors(): Palette {
  return palette(useColorScheme());
}

/** Navigation theme with our colours, so headers and page backgrounds match the screens. */
export function navigationTheme(scheme: ColorSchemeName) {
  const p = palette(scheme);
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      background: p.background,
      card: p.card,
      text: p.text,
      border: p.border,
      primary: p.accent,
    },
  };
}
