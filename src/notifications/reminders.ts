/**
 * Local reminder notifications (nothing is pushed from a server). expo-notifications is imported lazily so
 * tests and the demo never load it until a reminder is actually used.
 */
import { reminderId, reminderPlans, REMINDER_ROUTES, type ReminderKind, type Reminders } from '@/domain/reminders';

const load = () => import('expo-notifications');

/** True when we may show notifications; asks once if iOS has not been asked yet. */
export async function ensureReminderPermission(): Promise<boolean> {
  const N = await load();
  const have = await N.getPermissionsAsync();
  if (have.granted || have.ios?.status === N.IosAuthorizationStatus.PROVISIONAL) return true;
  if (!have.canAskAgain) return false;
  const asked = await N.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } });
  return asked.granted || asked.ios?.status === N.IosAuthorizationStatus.PROVISIONAL;
}

/** Makes the scheduled notifications match `reminders`: the old ones are removed and each enabled one repeats daily. */
export async function applyReminders(reminders: Reminders): Promise<void> {
  const N = await load();
  const kinds = Object.keys(REMINDER_ROUTES) as ReminderKind[];
  await Promise.all(kinds.map((k) => N.cancelScheduledNotificationAsync(reminderId(k))));
  for (const p of reminderPlans(reminders)) {
    await N.scheduleNotificationAsync({
      identifier: p.id,
      content: { title: p.title, body: p.body, data: { route: p.route } },
      // The app is iOS only, where a repeating time of day is a calendar trigger.
      trigger: { type: N.SchedulableTriggerInputTypes.CALENDAR, hour: p.hour, minute: p.minute, repeats: true },
    });
  }
}

/** Show a reminder as a banner even if Keel happens to be open when it fires. */
export async function configureReminderHandler(): Promise<void> {
  const N = await load();
  N.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}
