import { Task, TaskStatus } from '../types/index.ts';
import { getLocalDateString, parseLocalDate } from './dateUtils.ts';

export interface TaskCompletionResult {
  completed: Task;
  nextTask?: Task;
}

export interface TaskStatusResult {
  task: Task;
  nextTask?: Task;
}

function isValidYmd(dateStr: string | undefined): dateStr is string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function generateTaskId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `task-${crypto.randomUUID()}`;
  }
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Computes the next YYYY-MM-DD occurrence for a recurring task.
 * - Uses `todayStr` as the anchor when `task.recurAfterCompletion` is true;
 *   otherwise uses `task.dueDate` (falling back to `todayStr` if invalid).
 * - Advances according to `task.recurring` (`daily`, `weekdays`, `weekly`, `monthly`).
 * - Loops until the result is strictly greater than `todayStr` (`> todayStr`),
 *   so overdue recurring tasks never schedule in the past or today.
 */
export function computeNextDueDate(
  task: Pick<Task, 'dueDate' | 'recurring' | 'recurAfterCompletion'>,
  todayStr: string = getLocalDateString()
): string | null {
  const rule = task.recurring;
  if (!rule || rule === 'none') {
    return null;
  }

  const baseStr =
    task.recurAfterCompletion || !isValidYmd(task.dueDate) ? todayStr : task.dueDate;
  let cursor = parseLocalDate(baseStr);

  if (rule === 'daily') {
    let candidateStr = '';
    do {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
      candidateStr = getLocalDateString(cursor);
    } while (candidateStr <= todayStr);
    return candidateStr;
  }

  if (rule === 'weekdays') {
    let candidateStr = '';
    do {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
      while (cursor.getDay() === 0 || cursor.getDay() === 6) {
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
      }
      candidateStr = getLocalDateString(cursor);
    } while (candidateStr <= todayStr);
    return candidateStr;
  }

  if (rule === 'weekly') {
    let candidateStr = '';
    do {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7);
      candidateStr = getLocalDateString(cursor);
    } while (candidateStr <= todayStr);
    return candidateStr;
  }

  if (rule === 'monthly') {
    const baseYear = cursor.getFullYear();
    const baseMonth = cursor.getMonth();
    const anchorDay = cursor.getDate();
    let monthOffset = 1;
    let candidateStr = '';
    do {
      const totalMonths = baseMonth + monthOffset;
      const targetYear = baseYear + Math.floor(totalMonths / 12);
      const targetMonth = totalMonths % 12;
      const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
      const clampedDay = Math.min(anchorDay, daysInTargetMonth);
      candidateStr = getLocalDateString(new Date(targetYear, targetMonth, clampedDay));
      monthOffset++;
    } while (candidateStr <= todayStr);
    return candidateStr;
  }

  return null;
}

/**
 * Marks a task complete:
 * - sets `completed: true` and `status: 'done'`
 * - stamps `completedAt` with `now`
 * - marks all subtasks completed
 * - if `task.recurring` is active (not `'none'`), also builds `nextTask`
 *   with a new ID, reset subtasks, `completed: false`, `status: 'todo'`,
 *   no `completedAt` key, and `dueDate` set to the next future occurrence.
 */
export function completeTask(
  task: Task,
  now: number = Date.now(),
  todayStr: string = getLocalDateString(new Date(now))
): TaskCompletionResult {
  const completed: Task = {
    ...task,
    completed: true,
    status: 'done',
    completedAt: now,
    subtasks: task.subtasks.map((s) => ({ ...s, completed: true })),
  };

  const nextDueDate = computeNextDueDate(task, todayStr);
  if (!nextDueDate) {
    return { completed };
  }

  const nextTask: Task = {
    ...task,
    id: generateTaskId(),
    dueDate: nextDueDate,
    completed: false,
    status: 'todo',
    subtasks: task.subtasks.map((s) => ({ ...s, completed: false })),
    createdAt: now,
    updatedAt: now,
  };
  if (typeof nextTask.actualMinutes === 'number') {
    nextTask.actualMinutes = 0;
  }
  delete nextTask.completedAt;
  delete nextTask.deletedAt;

  return { completed, nextTask };
}

/**
 * Reopens a completed task:
 * - sets `completed: false` and `status: 'todo'`
 * - removes the `completedAt` key completely (never sets `undefined`)
 * - preserves subtasks as they are
 */
export function reopenTask(task: Task): Task {
  const next: Task = {
    ...task,
    completed: false,
    status: 'todo',
  };
  delete next.completedAt;
  return next;
}

/**
 * Transitions a task to any Kanban/drawer status:
 * - `'done'` delegates to `completeTask(task, now, todayStr)`
 * - any non-done status sets `completed: false`, removes `completedAt`, and preserves subtasks
 */
export function setStatus(
  task: Task,
  status: TaskStatus,
  now: number = Date.now(),
  todayStr: string = getLocalDateString(new Date(now))
): TaskStatusResult {
  if (status === 'done') {
    if (task.completed && task.status === 'done') {
      return { task };
    }
    const { completed, nextTask } = completeTask(task, now, todayStr);
    return { task: completed, nextTask };
  }
  const next: Task = {
    ...task,
    status,
    completed: false,
  };
  delete next.completedAt;
  return { task: next };
}
