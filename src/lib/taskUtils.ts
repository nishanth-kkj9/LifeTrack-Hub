import { Task } from '../types/index.ts';
import { getLocalDateString, parseLocalDate } from './dateUtils.ts';

const TASK_REMINDERS_KEY = 'lifetrack_task_reminders';
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Returns true if an uncompleted task is overdue relative to `now`:
 * - `dueDate < today` (in local calendar YYYY-MM-DD), OR
 * - `dueDate === today` and `dueTime` is set and strictly `< current HH:MM`.
 */
export function isOverdue(task: Task, now: Date | number = new Date()): boolean {
  if (task.completed || !task.dueDate) {
    return false;
  }

  const ref = now instanceof Date ? now : new Date(now);
  const todayStr = getLocalDateString(ref);

  if (task.dueDate < todayStr) {
    return true;
  }

  if (task.dueDate === todayStr && task.dueTime) {
    const match = task.dueTime.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return false;
    const dueH = parseInt(match[1], 10);
    const dueM = parseInt(match[2], 10);
    if (isNaN(dueH) || isNaN(dueM) || dueH < 0 || dueH > 23 || dueM < 0 || dueM > 59) {
      return false;
    }
    const normalizedDue = `${String(dueH).padStart(2, '0')}:${String(dueM).padStart(2, '0')}`;
    const currentHm = `${String(ref.getHours()).padStart(2, '0')}:${String(ref.getMinutes()).padStart(2, '0')}`;
    return normalizedDue < currentHm;
  }

  return false;
}

/**
 * Computes daily progress as tasks completed today divided by tasks due today.
 */
export function computeDailyProgress(
  tasks: Task[],
  todayStr: string = getLocalDateString()
): {
  completedToday: number;
  dueToday: number;
  percent: number;
} {
  const dueToday = tasks.filter((t) => t.dueDate === todayStr).length;
  const completedToday = tasks.filter((t) => {
    if (!t.completed) return false;
    if (typeof t.completedAt === 'number' && Number.isFinite(t.completedAt)) {
      return getLocalDateString(new Date(t.completedAt)) === todayStr;
    }
    return t.dueDate === todayStr;
  }).length;
  const percent =
    dueToday === 0 ? 0 : Math.min(100, Math.round((completedToday / dueToday) * 100));
  return { completedToday, dueToday, percent };
}

/**
 * Computes the local due timestamp (ms) for a task.
 * Uses `dueTime` when present, or defaults to 09:00 local time for date-only tasks.
 */
export function getTaskDueTimestamp(task: Task): number | null {
  if (!task.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)) {
    return null;
  }
  const base = parseLocalDate(task.dueDate);
  let hours = 9;
  let minutes = 0;
  if (task.dueTime) {
    const match = task.dueTime.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      const parsedH = parseInt(match[1], 10);
      const parsedM = parseInt(match[2], 10);
      if (parsedH >= 0 && parsedH <= 23 && parsedM >= 0 && parsedM <= 59) {
        hours = parsedH;
        minutes = parsedM;
      }
    }
  }
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), hours, minutes, 0, 0).getTime();
}

export function getTaskRemindersPreference(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(TASK_REMINDERS_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setTaskRemindersPreference(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TASK_REMINDERS_KEY, enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('lifetrack-task-reminders-changed', { detail: enabled }));
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

/**
 * Schedules browser Notification timers (setTimeout) for active tasks due in the next 24 hours.
 * Returns a cleanup function that cancels all scheduled timers.
 */
export function scheduleTaskReminders(
  tasks: Task[],
  nowMs: number = Date.now(),
  onNotify?: (task: Task) => void
): () => void {
  if (
    typeof window === 'undefined' ||
    typeof Notification === 'undefined' ||
    Notification.permission !== 'granted'
  ) {
    return () => {};
  }

  const timerIds: ReturnType<typeof setTimeout>[] = [];

  for (const task of tasks) {
    if (task.completed || task.deletedAt) continue;
    const dueMs = getTaskDueTimestamp(task);
    if (dueMs === null) continue;
    const delayMs = dueMs - nowMs;
    if (delayMs > 0 && delayMs <= TWENTY_FOUR_HOURS_MS) {
      const id = setTimeout(() => {
        try {
          new Notification(`Task due: ${task.title}`, {
            body: task.dueTime ? `Scheduled for ${task.dueTime}` : `Due ${task.dueDate}`,
            tag: `task-reminder-${task.id}`,
          });
          onNotify?.(task);
        } catch {
          // Ignore Notification constructor errors in restricted browser contexts
        }
      }, delayMs);
      timerIds.push(id);
    }
  }

  return () => {
    for (const id of timerIds) {
      clearTimeout(id);
    }
  };
}
