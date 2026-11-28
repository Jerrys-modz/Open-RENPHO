import {
  DEFAULT_REMINDERS,
  isReminderRoute,
  parseReminders,
  reminderDate,
  reminderId,
  reminderPlans,
  serializeReminders,
} from '../reminders';

describe('reminderPlans', () => {
  it('has no plans while every reminder is off', () => {
    expect(reminderPlans(DEFAULT_REMINDERS)).toEqual([]);
  });

  it('makes one plan per enabled reminder, with a stable id, a screen and generic text', () => {
    const plans = reminderPlans({ weigh: { enabled: true, hour: 6, minute: 45 }, bp: { enabled: true, hour: 20, minute: 0 } });
    expect(plans.map((p) => [p.id, p.route, p.hour, p.minute])).toEqual([
      [reminderId('weigh'), '/scale', 6, 45],
      [reminderId('bp'), '/bp', 20, 0],
    ]);
    for (const p of plans) expect(`${p.title} ${p.body}`).not.toMatch(/\d{2,3}\/\d{2,3}|kg|lb|mmHg/);
  });

  it('skips the one that is off', () => {
    const plans = reminderPlans({ weigh: { enabled: false, hour: 7, minute: 30 }, bp: { enabled: true, hour: 8, minute: 0 } });
    expect(plans.map((p) => p.kind)).toEqual(['bp']);
  });
});

describe('parseReminders', () => {
  it('round-trips', () => {
    const r = { weigh: { enabled: true, hour: 6, minute: 15 }, bp: { enabled: false, hour: 21, minute: 5 } };
    expect(parseReminders(serializeReminders(r))).toEqual(r);
  });

  it('falls back to the default for garbage or an impossible time', () => {
    expect(parseReminders('nope')).toEqual(DEFAULT_REMINDERS);
    const r = parseReminders(JSON.stringify({ weigh: { enabled: true, hour: 25, minute: 0 }, bp: { enabled: true, hour: 8, minute: 30 } }));
    expect(r.weigh).toEqual(DEFAULT_REMINDERS.weigh);
    expect(r.bp).toEqual({ enabled: true, hour: 8, minute: 30 });
  });
});

describe('helpers', () => {
  it('only lets a tapped notification open our own two screens', () => {
    expect(isReminderRoute('/bp')).toBe(true);
    expect(isReminderRoute('/scale')).toBe(true);
    expect(isReminderRoute('/profile')).toBe(false);
    expect(isReminderRoute('https://example.com')).toBe(false);
    expect(isReminderRoute(undefined)).toBe(false);
  });

  it('puts the reminder time on the given day', () => {
    const d = reminderDate({ hour: 7, minute: 30 }, new Date(2026, 10, 28, 15, 0));
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 10, 28, 7, 30]);
  });
});
