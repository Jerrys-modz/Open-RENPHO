import * as Notifications from 'expo-notifications';
import { router, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable, useColorScheme, View } from 'react-native';
import { isReminderRoute } from '@/domain/reminders';
import { configureReminderHandler } from '@/notifications/reminders';
import { navigationTheme, palette } from '@/ui/theme';

export default function RootLayout() {
  const scheme = useColorScheme();
  const colors = palette(scheme);

  // A reminder shows as a banner even while the app is open, and tapping it opens the screen it is for.
  useEffect(() => {
    void configureReminderHandler();
  }, []);
  const tapped = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!tapped || tapped.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const route = tapped.notification.request.content.data?.route;
    if (isReminderRoute(route)) router.push(route);
    void Notifications.clearLastNotificationResponseAsync();
  }, [tapped]);

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
        <Stack.Screen name="bp" options={{ title: 'Blood pressure' }} />
        <Stack.Screen name="tape" options={{ title: 'Tape measure' }} />
        <Stack.Screen name="profile" options={{ title: 'Profile' }} />
        <Stack.Screen name="reminders" options={{ title: 'Reminders' }} />
        <Stack.Screen name="history" options={{ title: 'History' }} />
        <Stack.Screen name="sync" options={{ title: 'Sync' }} />
        <Stack.Screen name="capture" options={{ title: 'Scale capture' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
