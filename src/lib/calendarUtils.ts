import { ExamReminder, Task, TaskPriority } from '../types/index.ts';
import { getLocalDateOffset, getLocalDateString, getLocalMonthPrefix, parseLocalDate } from './dateUtils.ts';
import { nextOccurrence } from './taskActions.ts';
import { isOverdue } from './taskUtils.ts';

export interface DayBucket {
  pending: Task[];
  done: Task[];
  overdue: boolean;
  exams: ExamReminder[];
}

export interface MonthStatsResult {
  exams: number;
  done: number;
  pending: number;
}

/**
 * Builds day buckets for `[monthStartYmd, monthEndYmd]` in a single pass over `tasks`
 * and a single pass over `exams`.
 * - Pending tasks are bucketed by `dueDate` (with `overdue` flag via `isOverdue`).
 * - Completed tasks are bucketed by `completedAt` local YYYY-MM-DD (falling back to `dueDate`).
 * - Exams are bucketed by `examDate`.
 */
export function buildDayBuckets(
  tasks: Task[],
  exams: ExamReminder[],
  monthStartYmd: string,
  monthEndYmd: string,
  now: Date | number = new Date()
): Map<string, DayBucket> {
  const buckets = new Map<string, DayBucket>();

  const ensureBucket = (ymd: string): DayBucket => {
    let bucket = buckets.get(ymd);
    if (!bucket) {
      bucket = { pending: [], done: [], overdue: false, exams: [] };
      buckets.set(ymd, bucket);
    }
    return bucket;
  };

  for (const task of tasks) {
    if (task.completed) {
      const doneYmd =
        typeof task.completedAt === 'number' && Number.isFinite(task.completedAt)
          ? getLocalDateString(new Date(task.completedAt))
          : task.dueDate;
      if (doneYmd && doneYmd >= monthStartYmd && doneYmd <= monthEndYmd) {
        ensureBucket(doneYmd).done.push(task);
      }
    } else if (task.dueDate && task.dueDate >= monthStartYmd && task.dueDate <= monthEndYmd) {
      const bucket = ensureBucket(task.dueDate);
      bucket.pending.push(task);
      if (isOverdue(task, now)) {
        bucket.overdue = true;
      }
    }
  }

  for (const exam of exams) {
    if (exam.examDate && exam.examDate >= monthStartYmd && exam.examDate <= monthEndYmd) {
      ensureBucket(exam.examDate).exams.push(exam);
    }
  }

  return buckets;
}

/**
 * Returns a 35- or 42-cell array of `YYYY-MM-DD` strings covering the month grid
 * starting on Sunday (`weekStart = 0`) or Monday (`weekStart = 1`).
 */
export function getMonthGrid(viewMonth: Date, weekStart: 0 | 1 = 0): string[] {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun .. 6 = Sat
  const leadingCount = (firstDayOfWeek - weekStart + 7) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = leadingCount + daysInMonth > 35 ? 42 : 35;

  const grid: string[] = [];
  for (let i = 0; i < totalCells; i++) {
    const cellDate = new Date(year, month, 1 - leadingCount + i);
    grid.push(getLocalDateString(cellDate));
  }
  return grid;
}

/**
 * Returns the 7 `YYYY-MM-DD` strings for the week containing `anchorDateStr`,
 * starting on Sunday (`weekStart = 0`) or Monday (`weekStart = 1`).
 */
export function getWeekDays(anchorDateStr: string, weekStart: 0 | 1 = 0): string[] {
  const anchor = parseLocalDate(anchorDateStr);
  const colIndex = (anchor.getDay() - weekStart + 7) % 7;
  const weekStartDate = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    anchor.getDate() - colIndex
  );

  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(
      getLocalDateString(
        new Date(weekStartDate.getFullYear(), weekStartDate.getMonth(), weekStartDate.getDate() + i)
      )
    );
  }
  return days;
}

/**
 * Computes monthly totals from day buckets for `month` (`Date` or `YYYY-MM` string):
 * - `exams`: total number of exams in the month (multiple exams on one day each count)
 * - `done`: completed tasks whose `completedAt` falls in `month` (falling back to `dueDate`)
 * - `pending`: pending tasks due in `month`
 */
export function monthStats(
  buckets: Map<string, DayBucket>,
  month: Date | string
): MonthStatsResult {
  const monthPrefix =
    typeof month === 'string' ? month.slice(0, 7) : getLocalMonthPrefix(month);

  let exams = 0;
  let done = 0;
  let pending = 0;

  for (const [dateStr, bucket] of buckets.entries()) {
    if (!dateStr.startsWith(monthPrefix)) continue;
    exams += bucket.exams.length;
    pending += bucket.pending.length;
    for (const task of bucket.done) {
      const doneYmd =
        typeof task.completedAt === 'number' && Number.isFinite(task.completedAt)
          ? getLocalDateString(new Date(task.completedAt))
          : task.dueDate;
      if (doneYmd && doneYmd.startsWith(monthPrefix)) {
        done++;
      }
    }
  }

  return { exams, done, pending };
}

export interface AgendaItem {
  id: string;
  date: string;
  time?: string;
  title: string;
  type: 'task' | 'exam';
  priority: TaskPriority;
  category: string;
  completed?: boolean;
  courseCode?: string;
  taskRef?: Task;
}

export interface AgendaDateGroup {
  date: string;
  headerLabel: string;
  items: AgendaItem[];
}

/**
 * Returns pending tasks with `dueDate < today`, verified via `isOverdue`, sorted oldest first.
 */
export function getOverdueTasks(
  tasks: Task[],
  now: Date | number = new Date()
): Task[] {
  const ref = now instanceof Date ? now : new Date(now);
  const todayStr = getLocalDateString(ref);

  return tasks
    .filter((t) => isOverdue(t, ref) && Boolean(t.dueDate) && t.dueDate < todayStr)
    .sort((a, b) => {
      const dDiff = a.dueDate.localeCompare(b.dueDate);
      if (dDiff !== 0) return dDiff;
      return (a.dueTime || '23:59').localeCompare(b.dueTime || '23:59');
    });
}

/**
 * Formats an agenda date header: "Today", "Tomorrow", or "Mon, Nov 23".
 */
export function formatAgendaDateHeader(
  dateStr: string,
  todayStr: string,
  tomorrowStr: string
): string {
  if (dateStr === todayStr) return 'Today';
  if (dateStr === tomorrowStr) return 'Tomorrow';
  return parseLocalDate(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Groups upcoming tasks and exams within `[today, today + rangeDays]` under date headers.
 */
export function buildAgendaGroups(
  tasks: Task[],
  exams: ExamReminder[],
  options: {
    todayStr?: string;
    rangeDays: 7 | 30 | 90;
    showCompleted: boolean;
    now?: Date;
  }
): AgendaDateGroup[] {
  const ref = options.now ?? new Date();
  const todayStr = options.todayStr ?? getLocalDateString(ref);
  const baseDate = parseLocalDate(todayStr);
  const tomorrowStr = getLocalDateOffset(1, baseDate);
  const maxDateStr = getLocalDateOffset(options.rangeDays, baseDate);

  const byDate = new Map<string, AgendaItem[]>();
  const pushItem = (item: AgendaItem) => {
    let list = byDate.get(item.date);
    if (!list) {
      list = [];
      byDate.set(item.date, list);
    }
    list.push(item);
  };

  for (const t of tasks) {
    if (!t.dueDate || t.dueDate < todayStr || t.dueDate > maxDateStr) continue;
    if (!options.showCompleted && t.completed) continue;
    pushItem({
      id: t.id,
      date: t.dueDate,
      time: t.dueTime,
      title: t.title,
      type: 'task',
      priority: t.priority,
      category: t.category,
      completed: t.completed,
      taskRef: t,
    });
  }

  for (const e of exams) {
    if (!e.examDate || e.examDate < todayStr || e.examDate > maxDateStr) continue;
    pushItem({
      id: e.id,
      date: e.examDate,
      time: e.examTime,
      title: e.subject,
      type: 'exam',
      priority: 'urgent',
      category: 'academic',
      courseCode: e.courseCode,
    });
  }

  const sortedDates = Array.from(byDate.keys()).sort((a, b) => a.localeCompare(b));

  return sortedDates.map((date) => {
    const items = byDate.get(date)!.sort((a, b) => {
      const tDiff = (a.time || '23:59').localeCompare(b.time || '23:59');
      if (tDiff !== 0) return tDiff;
      if (a.type !== b.type) return a.type === 'exam' ? -1 : 1;
      return a.title.localeCompare(b.title);
    });

    return {
      date,
      headerLabel: formatAgendaDateHeader(date, todayStr, tomorrowStr),
      items,
    };
  });
}

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Shifts `viewMonth` to `targetMonthDate` while keeping the same day-of-month
 * selected (clamped to the target month's length).
 */
export function shiftMonthKeepingDay(
  selectedDateStr: string,
  targetMonthDate: Date
): { nextViewMonth: Date; nextSelectedDate: string } {
  const year = targetMonthDate.getFullYear();
  const month = targetMonthDate.getMonth();
  const parsed = parseLocalDate(selectedDateStr);
  const currentDay = parsed.getDate();
  const daysInTarget = new Date(year, month + 1, 0).getDate();
  const clampedDay = Math.min(currentDay, daysInTarget);

  return {
    nextViewMonth: new Date(year, month, 1),
    nextSelectedDate: getLocalDateString(new Date(year, month, clampedDay)),
  };
}

/**
 * Builds an accessible ARIA label for a calendar gridcell, e.g.:
 * "Friday, 20 November 2026, 5 tasks pending, 1 completed, exam: DBMS"
 */
export function formatCalendarCellAriaLabel(params: {
  dateStr: string;
  pendingCount: number;
  completedCount: number;
  exams: Array<{ subject: string }>;
}): string {
  const d = parseLocalDate(params.dateStr);
  const datePart = `${WEEKDAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  const pendingLabel = `${params.pendingCount} ${params.pendingCount === 1 ? 'task' : 'tasks'} pending`;
  const parts = [datePart, pendingLabel];

  if (params.completedCount > 0) {
    parts.push(`${params.completedCount} completed`);
  }

  if (params.exams.length === 1) {
    parts.push(`exam: ${params.exams[0].subject}`);
  } else if (params.exams.length > 1) {
    parts.push(`exams: ${params.exams.map((e) => e.subject).join(', ')}`);
  }

  return parts.join(', ');
}

/**
 * Computes the next selected date and view month for calendar grid keyboard navigation.
 * Supports ArrowLeft/Right/Up/Down, PageUp/PageDown, and Home/End (aligned to `weekStart`).
 */
export function computeCalendarKeyNavigation(
  key: string,
  currentDateStr: string,
  weekStart: 0 | 1
): { nextDateStr: string; nextViewMonth: Date } | null {
  const current = parseLocalDate(currentDateStr);

  if (key === 'ArrowLeft') {
    const next = new Date(current.getFullYear(), current.getMonth(), current.getDate() - 1);
    return {
      nextDateStr: getLocalDateString(next),
      nextViewMonth: new Date(next.getFullYear(), next.getMonth(), 1),
    };
  }
  if (key === 'ArrowRight') {
    const next = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1);
    return {
      nextDateStr: getLocalDateString(next),
      nextViewMonth: new Date(next.getFullYear(), next.getMonth(), 1),
    };
  }
  if (key === 'ArrowUp') {
    const next = new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7);
    return {
      nextDateStr: getLocalDateString(next),
      nextViewMonth: new Date(next.getFullYear(), next.getMonth(), 1),
    };
  }
  if (key === 'ArrowDown') {
    const next = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7);
    return {
      nextDateStr: getLocalDateString(next),
      nextViewMonth: new Date(next.getFullYear(), next.getMonth(), 1),
    };
  }
  if (key === 'PageUp') {
    const targetMonth = new Date(current.getFullYear(), current.getMonth() - 1, 1);
    const { nextViewMonth, nextSelectedDate } = shiftMonthKeepingDay(currentDateStr, targetMonth);
    return { nextDateStr: nextSelectedDate, nextViewMonth };
  }
  if (key === 'PageDown') {
    const targetMonth = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    const { nextViewMonth, nextSelectedDate } = shiftMonthKeepingDay(currentDateStr, targetMonth);
    return { nextDateStr: nextSelectedDate, nextViewMonth };
  }
  if (key === 'Home') {
    const colIndex = (current.getDay() - weekStart + 7) % 7;
    const next = new Date(current.getFullYear(), current.getMonth(), current.getDate() - colIndex);
    return {
      nextDateStr: getLocalDateString(next),
      nextViewMonth: new Date(next.getFullYear(), next.getMonth(), 1),
    };
  }
  if (key === 'End') {
    const colIndex = (current.getDay() - weekStart + 7) % 7;
    const next = new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate() + (6 - colIndex)
    );
    return {
      nextDateStr: getLocalDateString(next),
      nextViewMonth: new Date(next.getFullYear(), next.getMonth(), 1),
    };
  }

  return null;
}

export interface ProjectedRepeat {
  id: string;
  sourceTaskId: string;
  title: string;
  priority: TaskPriority;
  dueDate: string;
  dueTime?: string;
}

/**
 * Projects future recurring task occurrences within `[gridStartYmd, gridEndYmd]`
 * using `nextOccurrence` from `taskActions.ts` without mutating or persisting tasks.
 */
export function projectRecurringOccurrences(
  tasks: Task[],
  gridStartYmd: string,
  gridEndYmd: string,
  todayStr: string = getLocalDateString()
): Map<string, ProjectedRepeat[]> {
  const map = new Map<string, ProjectedRepeat[]>();
  if (gridEndYmd <= todayStr) {
    return map;
  }

  for (const task of tasks) {
    if (task.completed || !task.recurring || task.recurring === 'none') {
      continue;
    }

    let cursorRef = task.dueDate && task.dueDate > todayStr ? task.dueDate : todayStr;
    let cursorDue = task.dueDate || cursorRef;

    for (let step = 0; step < 400; step++) {
      const nextYmd = nextOccurrence(
        {
          dueDate: cursorDue,
          recurring: task.recurring,
          recurAfterCompletion: false,
        },
        cursorRef
      );

      if (!nextYmd || nextYmd <= cursorRef || nextYmd > gridEndYmd) {
        break;
      }

      if (nextYmd >= gridStartYmd && nextYmd !== task.dueDate) {
        let bucket = map.get(nextYmd);
        if (!bucket) {
          bucket = [];
          map.set(nextYmd, bucket);
        }
        bucket.push({
          id: `repeat-${task.id}-${nextYmd}`,
          sourceTaskId: task.id,
          title: task.title,
          priority: task.priority,
          dueDate: nextYmd,
          dueTime: task.dueTime,
        });
      }

      cursorRef = nextYmd;
      cursorDue = nextYmd;
    }
  }

  return map;
}
