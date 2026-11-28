import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Switch, useColorScheme, View } from 'react-native';
import { reminderDate, type ReminderKind, type Reminders } from '@/domain/reminders';
import { applyReminders, ensureReminderPermission } from '@/notifications/reminders';
import { saveReminders, useReminders } from '@/storage/useReminders';
import { Card, SectionTitle } from '@/ui/components';
import { ThemedText } from '@/ui/ThemedText';

const ROWS: { kind: ReminderKind; title: string; text: string }[] = [
  { kind: 'weigh', title: 'Weigh-in', text: 'A nudge to step on the scale.' },
  { kind: 'bp', title: 'Blood pressure', text: 'A nudge to take a reading and sync your cuff.' },
];

export default function RemindersScreen() {
  const reminders = useReminders();
  const scheme = useColorScheme();
  const [busy, setBusy] = useState(false);

  const change = async (next: Reminders) => {
    setBusy(true);
    try {
      await applyReminders(next);
      saveReminders(next);
    } catch (e) {
      Alert.alert('Could not set the reminder', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (kind: ReminderKind, on: boolean) => {
    if (on && !(await ensureReminderPermission())) {
      Alert.alert('Notifications are off for Keel', 'Allow notifications for Keel in Settings to get reminders.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void Linking.openSettings() },
      ]);
      return;
    }
    await change({ ...reminders, [kind]: { ...reminders[kind], enabled: on } });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText subtle style={styles.intro}>
        A reminder repeats every day at the time you choose. It is a notification made on your phone: nothing is sent anywhere, and it
        never shows your readings.
      </ThemedText>
      {ROWS.map(({ kind, title, text }) => (
        <View key={kind} style={{ gap: 8 }}>
          <SectionTitle>{title}</SectionTitle>
          <Card style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.title}>Remind me</ThemedText>
                <ThemedText subtle style={styles.hint}>
                  {text}
                </ThemedText>
              </View>
              <Switch value={reminders[kind].enabled} onValueChange={(v) => void toggle(kind, v)} disabled={busy} />
            </View>
            {reminders[kind].enabled && (
              <View style={styles.row}>
                <ThemedText>Every day at</ThemedText>
                <DateTimePicker
                  value={reminderDate(reminders[kind])}
                  mode="time"
                  display="compact"
                  themeVariant={scheme === 'dark' ? 'dark' : 'light'}
                  onChange={(_, date) => {
                    if (date) void change({ ...reminders, [kind]: { enabled: true, hour: date.getHours(), minute: date.getMinutes() } });
                  }}
                />
              </View>
            )}
          </Card>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  intro: { fontSize: 14 },
  card: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 17, fontWeight: '600' },
  hint: { fontSize: 13 },
});
