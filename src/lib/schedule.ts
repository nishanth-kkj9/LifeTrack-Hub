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
  const start = new Date(startDate);
  const result: string[] = [];

  const dayKeys = daysOfWeek?.length ? daysOfWeek : [0, 1, 2, 3, 4, 5, 6];
  const totalDays = timesPerWeek ?? 1;

  for (let i = 0; i < totalDays; i += 1) {
    const current = new Date(start);
    current.setDate(start.getDate() + i);
    const day = current.getDay();

    if (dayKeys.includes(day)) {
      result.push(current.toISOString().slice(0, 10));
    }
  }

  return result;
}
