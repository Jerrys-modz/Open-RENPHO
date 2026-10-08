import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { navigationTheme } from '@/ui/theme';

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <ThemeProvider value={navigationTheme(scheme)}>
      <Stack screenOptions={{ headerShadowVisible: false }}>
        <Stack.Screen name="index" options={{ title: 'Overview' }} />
        <Stack.Screen name="scale" options={{ title: 'Weigh in' }} />
        <Stack.Screen name="tape" options={{ title: 'Tape measure' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
