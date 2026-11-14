import { Task, TaskPriority } from '../types/index.ts';
import { getLocalDateOffset, getLocalDateString } from './dateUtils.ts';
import { isOverdue } from './taskUtils.ts';

export type MatrixQuadrant = 'q1' | 'q2' | 'q3' | 'q4';

export interface MatrixClassification {
  urgent: boolean;
  important: boolean;
  quadrant: MatrixQuadrant;
}

/**
 * Urgent = due within 2 days (`dueDate <= today + 2 days`) or overdue.
 */
export function isMatrixUrgent(task: Task, now: Date | number = new Date()): boolean {
  if (isOverdue(task, now)) {
    return true;
  }
  if (!task.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)) {
    return false;
  }
  const ref = now instanceof Date ? now : new Date(now);
  const twoDaysOut = getLocalDateOffset(2, ref);
  return task.dueDate <= twoDaysOut;
}

/**
 * Important = priority in ('urgent', 'high') or `isStarred` is true.
 */
export function isMatrixImportant(task: Task): boolean {
  return task.priority === 'urgent' || task.priority === 'high' || Boolean(task.isStarred);
}

/**
 * Derives `{ urgent, important, quadrant }` from real task fields.
 */
export function classifyMatrixTask(
  task: Task,
  now: Date | number = new Date()
): MatrixClassification {
  const urgent = isMatrixUrgent(task, now);
  const important = isMatrixImportant(task);

  let quadrant: MatrixQuadrant;
  if (urgent && important) quadrant = 'q1';
  else if (!urgent && important) quadrant = 'q2';
  else if (urgent && !important) quadrant = 'q3';
  else quadrant = 'q4';

  return { urgent, important, quadrant };
}

/**
 * Moves a task into a target Eisenhower Matrix quadrant by explicitly updating
 * `dueDate` (urgency axis) and `priority` / `isStarred` (importance axis).
 */
export function moveTaskToQuadrant(
  task: Task,
  targetQuadrant: MatrixQuadrant,
  now: Date | number = new Date()
): Task {
  const ref = now instanceof Date ? now : new Date(now);
  const todayStr = getLocalDateString(ref);
  const laterDateStr = getLocalDateOffset(3, ref);

  const currentlyUrgent = isMatrixUrgent(task, ref);
  const currentlyImportant = isMatrixImportant(task);

  const wantsUrgent = targetQuadrant === 'q1' || targetQuadrant === 'q3';
  const wantsImportant = targetQuadrant === 'q1' || targetQuadrant === 'q2';

  let nextDueDate = task.dueDate;
  if (wantsUrgent && !currentlyUrgent) {
    nextDueDate = todayStr;
  } else if (!wantsUrgent && currentlyUrgent) {
    nextDueDate = laterDateStr;
  }

  let nextPriority: TaskPriority = task.priority;
  let nextIsStarred = task.isStarred;

  if (wantsImportant && !currentlyImportant) {
    nextPriority = targetQuadrant === 'q1' ? 'urgent' : 'high';
  } else if (!wantsImportant && currentlyImportant) {
    if (task.priority === 'urgent' || task.priority === 'high') {
      nextPriority = targetQuadrant === 'q3' ? 'medium' : 'low';
    }
    if (task.isStarred) {
      nextIsStarred = false;
    }
  }

  return {
    ...task,
    dueDate: nextDueDate,
    priority: nextPriority,
    ...(nextIsStarred !== task.isStarred ? { isStarred: nextIsStarred } : {}),
  };
}
