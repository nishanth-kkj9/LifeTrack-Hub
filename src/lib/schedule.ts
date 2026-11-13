import { getLocalDateString, parseLocalDate } from './dateUtils.ts';

export type HabitStatus =
  | 'COMPLETED'
  | 'FAILED'
  | 'DUE'
  | 'NOT_DUE'
  | 'SKIPPED';

export interface ComputeHabitStatusInput {
  completedDates: string[];
  dueDates: string[];
  skippedDates: string[];
  targetDate: string;
}

export function computeHabitStatus({
  completedDates,
  dueDates,
  skippedDates,
  targetDate,
}: ComputeHabitStatusInput): HabitStatus {
  const completed = completedDates.includes(targetDate);
  const due = dueDates.includes(targetDate);
  const skipped = skippedDates.includes(targetDate);

  if (skipped) return 'SKIPPED';
  if (completed) return 'COMPLETED';
  if (due && !completed) return 'FAILED';
  if (!due) return 'NOT_DUE';

  return 'DUE';
}

export function computeAdaptiveSchedule({
  completedDates,
  dueDates,
  skippedDates,
  targetDate,
}: ComputeHabitStatusInput) {
  const status = computeHabitStatus({
    completedDates,
    dueDates,
    skippedDates,
    targetDate,
  });

  const backlogDays = dueDates.filter((date) => !completedDates.includes(date)).length;

  return {
    status,
    nextRecommendedDate: targetDate,
    deviationFromSchedule: backlogDays,
    backlog: status === 'FAILED' || status === 'DUE',
  };
}

export function generateDueDates({
  startDate,
  daysOfWeek,
  timesPerWeek,
}: {
  startDate: string;
  daysOfWeek?: number[];
  timesPerWeek?: number;
}) {
  const start = parseLocalDate(startDate);
  const result: string[] = [];

  const dayKeys = daysOfWeek?.length ? daysOfWeek : [0, 1, 2, 3, 4, 5, 6];
  const totalDays = timesPerWeek ?? 1;

  for (let i = 0; i < totalDays; i += 1) {
    const current = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const day = current.getDay();

    if (dayKeys.includes(day)) {
      result.push(getLocalDateString(current));
    }
  }

  return result;
}

export function calculateHabitStreaks(
  completedDates: string[],
  referenceDate: Date = new Date()
): { current: number; longest: number } {
  if (!completedDates || !completedDates.length) return { current: 0, longest: 0 };

  const sortedAsc = [...new Set(completedDates)].sort();
  const completionSet = new Set(sortedAsc);

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  const todayStr = getLocalDateString(referenceDate);
  const yesterday = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);

  // Check if today or yesterday is completed (grace window)
  const checkDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  if (completionSet.has(todayStr)) {
    currentStreak = 1;
    checkDate.setDate(checkDate.getDate() - 1);
  } else if (completionSet.has(yesterdayStr)) {
    currentStreak = 1;
    checkDate.setTime(yesterday.getTime());
    checkDate.setDate(checkDate.getDate() - 1);
  }

  // Calculate current streak backward
  if (currentStreak > 0) {
    while (true) {
      const dateStr = getLocalDateString(checkDate);
      if (completionSet.has(dateStr)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // Calculate longest streak in ascending order
  for (let i = 0; i < sortedAsc.length; i++) {
    if (i === 0) {
      tempStreak = 1;
    } else {
      const [y1, m1, d1] = sortedAsc[i].split('-').map(Number);
      const [y0, m0, d0] = sortedAsc[i - 1].split('-').map(Number);
      const curr = new Date(y1, m1 - 1, d1);
      const expected = new Date(y0, m0 - 1, d0 + 1);

      if (getLocalDateString(curr) === getLocalDateString(expected)) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak, currentStreak);

  return { current: currentStreak, longest: longestStreak };
}
