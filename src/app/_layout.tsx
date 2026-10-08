import { router, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { Pressable, useColorScheme } from 'react-native';
import { navigationTheme, palette } from '@/ui/theme';

export default function RootLayout() {
  const scheme = useColorScheme();
  const colors = palette(scheme);
  return (
    <ThemeProvider value={navigationTheme(scheme)}>
      <Stack screenOptions={{ headerShadowVisible: false }}>
        <Stack.Screen
          name="index"
          options={{
            title: 'Overview',
            headerRight: () => (
              <Pressable onPress={() => router.push('/profile')} accessibilityLabel="Profile" hitSlop={12}>
                <SymbolView name="person.crop.circle" size={26} tintColor={colors.accent} />
              </Pressable>
            ),
          }}
        />
        <Stack.Screen name="scale" options={{ title: 'Weigh in' }} />
        <Stack.Screen name="tape" options={{ title: 'Tape measure' }} />
        <Stack.Screen name="profile" options={{ title: 'Profile' }} />
        <Stack.Screen name="capture" options={{ title: 'Scale capture' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
