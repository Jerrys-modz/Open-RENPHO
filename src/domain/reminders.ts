export type ReminderKind = 'weigh' | 'bp';

export interface Reminder {
  enabled: boolean;
  /** 0 to 23, local time. */
  hour: number;
  /** 0 to 59. */
  minute: number;
}

export type Reminders = Record<ReminderKind, Reminder>;

export const DEFAULT_REMINDERS: Reminders = {
  weigh: { enabled: false, hour: 7, minute: 30 },
  bp: { enabled: false, hour: 8, minute: 0 },
};

/** Screens a notification may open. Anything else in a tapped notification is ignored. */
export const REMINDER_ROUTES = { weigh: '/scale', bp: '/bp' } as const;
export type ReminderRoute = (typeof REMINDER_ROUTES)[ReminderKind];

export const isReminderRoute = (r: unknown): r is ReminderRoute => r === '/scale' || r === '/bp';

/** Notification text is generic on purpose: nothing about your health shows on the lock screen. */
export const REMINDER_TEXT: Record<ReminderKind, { title: string; body: string }> = {
  weigh: { title: 'Time to weigh in', body: 'Open Keel and step on the scale.' },
  bp: { title: 'Time for a blood-pressure reading', body: 'Open Keel to sync your cuff.' },
};

export interface ReminderPlan {
  /** Stable, so scheduling again replaces the old one. */
  id: string;
  kind: ReminderKind;
  title: string;
  body: string;
  route: ReminderRoute;
  hour: number;
  minute: number;
}

export const reminderId = (kind: ReminderKind) => `keel-reminder-${kind}`;

/** One plan per enabled reminder. */
export function reminderPlans(r: Reminders): ReminderPlan[] {
  return (Object.keys(r) as ReminderKind[])
    .filter((k) => r[k].enabled)
    .map((k) => ({ id: reminderId(k), kind: k, ...REMINDER_TEXT[k], route: REMINDER_ROUTES[k], hour: r[k].hour, minute: r[k].minute }));
}

const validTime = (h: unknown, m: unknown): h is number =>
  typeof h === 'number' && Number.isInteger(h) && h >= 0 && h <= 23 && typeof m === 'number' && Number.isInteger(m) && m >= 0 && m <= 59;

export function serializeReminders(r: Reminders): string {
  return JSON.stringify({ version: 1, ...r });
}

/** Tolerant: anything unreadable falls back to the default for that reminder. */
export function parseReminders(text: string): Reminders {
  try {
    const d = JSON.parse(text) as Partial<Record<ReminderKind, Partial<Reminder>>>;
    const one = (k: ReminderKind): Reminder => {
      const x = d[k];
      if (!x || typeof x !== 'object' || !validTime(x.hour, x.minute)) return DEFAULT_REMINDERS[k];
      return { enabled: x.enabled === true, hour: x.hour as number, minute: x.minute as number };
    };
    return { weigh: one('weigh'), bp: one('bp') };
  } catch {
    return DEFAULT_REMINDERS;
  }
}

/** A Date today at the reminder's time, for the time picker. */
export const reminderDate = (r: Pick<Reminder, 'hour' | 'minute'>, base: Date = new Date()): Date =>
  new Date(base.getFullYear(), base.getMonth(), base.getDate(), r.hour, r.minute, 0, 0);
