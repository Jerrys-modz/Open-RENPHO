import { router, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { Pressable, useColorScheme, View } from 'react-native';
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
              <View style={{ flexDirection: 'row', gap: 18 }}>
                <Pressable onPress={() => router.push('/sync')} accessibilityLabel="Sync" hitSlop={12}>
                  <SymbolView name="arrow.triangle.2.circlepath.circle" size={26} tintColor={colors.accent} />
                </Pressable>
                <Pressable onPress={() => router.push('/profile')} accessibilityLabel="Profile" hitSlop={12}>
                  <SymbolView name="person.crop.circle" size={26} tintColor={colors.accent} />
                </Pressable>
              </View>
            ),
          }}
        />
        <Stack.Screen name="scale" options={{ title: 'Weigh in' }} />
        <Stack.Screen name="tape" options={{ title: 'Tape measure' }} />
        <Stack.Screen name="profile" options={{ title: 'Profile' }} />
        <Stack.Screen name="sync" options={{ title: 'Sync' }} />
        <Stack.Screen name="capture" options={{ title: 'Scale capture' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
