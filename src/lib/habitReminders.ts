import { Habit } from '../types/index.ts';
import { getLocalDateString } from './dateUtils.ts';
import { isActive } from './entity.ts';
import { isHabitDueOnDate } from './habitScoring.ts';

export const REMINDER_TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function isValidReminderTime(value: unknown): value is string {
  return typeof value === 'string' && REMINDER_TIME_RE.test(value);
}

export interface DueHabitReminder {
  habit: Habit;
  dateStr: string;
  hhmm: string;
  dedupKey: string;
}

export function formatLocalHhMm(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Pure check for habits with a matching local `HH:MM` reminder that are due today,
 * unchecked, and not yet notified in the current in-memory session set.
 */
export function getDueHabitReminders(
  habits: Habit[],
  now: Date = new Date(),
  sentKeys: Set<string> = new Set()
): DueHabitReminder[] {
  const dateStr = getLocalDateString(now);
  const hhmm = formatLocalHhMm(now);
  const due: DueHabitReminder[] = [];

  for (const habit of habits) {
    if (!habit || !isActive(habit)) continue;
    if (!isValidReminderTime(habit.reminderTime) || habit.reminderTime !== hhmm) continue;
    const completed = Array.isArray(habit.completedDates) ? habit.completedDates : [];
    if (completed.includes(dateStr)) continue;
    if (!isHabitDueOnDate(habit, dateStr)) continue;

    const dedupKey = `${habit.id}:${dateStr}:${hhmm}`;
    if (sentKeys.has(dedupKey)) continue;

    due.push({ habit, dateStr, hhmm, dedupKey });
  }

  return due;
}

/**
 * Prompts browser notification permission only when the user explicitly sets a reminder.
 */
export function requestHabitReminderPermission(): void {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
  if (Notification.permission === 'default' && typeof Notification.requestPermission === 'function') {
    try {
      const maybePromise = Notification.requestPermission();
      if (maybePromise && typeof (maybePromise as Promise<unknown>).catch === 'function') {
        (maybePromise as Promise<unknown>).catch(() => {});
      }
    } catch {
      // Ignore permission rejection / unsupported environments
    }
  }
}

/**
 * Fires browser Notifications for due, unchecked habits at their reminderTime.
 * Uses an in-memory Set only so nothing sensitive is persisted.
 */
export function dispatchDueHabitNotifications(
  habits: Habit[],
  now: Date = new Date(),
  sentKeys: Set<string> = new Set()
): number {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return 0;
  if (Notification.permission !== 'granted') return 0;

  const due = getDueHabitReminders(habits, now, sentKeys);
  let fired = 0;

  for (const item of due) {
    sentKeys.add(item.dedupKey);
    try {
      new Notification(item.habit.name, {
        body: 'Habit reminder: scheduled check-in is due today.',
        tag: item.dedupKey,
      });
      fired++;
    } catch {
      // Ignore environments where Notification constructor throws
    }
  }

  return fired;
}

/**
 * Schedules periodic checks while the app is open (cleans up on unmount).
 */
export function scheduleHabitReminders(
  habits: Habit[],
  sentKeys: Set<string> = new Set()
): () => void {
  dispatchDueHabitNotifications(habits, new Date(), sentKeys);
  const timer = setInterval(() => {
    dispatchDueHabitNotifications(habits, new Date(), sentKeys);
  }, 30_000);
  return () => clearInterval(timer);
}
