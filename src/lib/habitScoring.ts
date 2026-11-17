import { Habit, VacationPeriod } from '../types/index.ts';
import { getLocalDateString, getLocalDateOffset, parseLocalDate } from './dateUtils.ts';

export type HabitTodayStatus = 'COMPLETED' | 'DUE' | 'REST';

export interface HabitStrengthAnalysis {
  strengthScore: number; // 0-100
  completionRate: number; // 0-100 (clamped)
  monthlyCompletionRate: number; // 0-100%
  currentStreak: number;
  bestStreak: number;
  backlogDays: number;
  isDueToday: boolean;
  isOnVacationToday: boolean;
  healthLabel: 'Excellent' | 'Strong' | 'Stable' | 'Building' | 'Needs focus';
  levelLabel: string;
  levelBadgeColor: string;
  resilienceRating: 'High' | 'Moderate' | 'Developing' | 'Needs Attention';
}

/**
 * Checks if a given YYYY-MM-DD date falls within any active vacation period
 */
export function expandVacationDates(vacationPeriods?: VacationPeriod[]): string[] {
  if (!Array.isArray(vacationPeriods) || vacationPeriods.length === 0) return [];
  const dates = new Set<string>();
  for (const v of vacationPeriods) {
    if (
      !v ||
      typeof v.startDate !== 'string' ||
      typeof v.endDate !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(v.startDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(v.endDate) ||
      v.startDate > v.endDate
    ) {
      continue;
    }
    let cursor = parseLocalDate(v.startDate);
    for (let guard = 0; guard < 1095; guard++) {
      const dStr = getLocalDateString(cursor);
      dates.add(dStr);
      if (dStr >= v.endDate) break;
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    }
  }
  return Array.from(dates).sort();
}

export function isDateInVacation(dateStr: string, vacationPeriods?: VacationPeriod[]): boolean {
  if (!Array.isArray(vacationPeriods) || vacationPeriods.length === 0) return false;
  return vacationPeriods.some(
    (v) =>
      Boolean(v) &&
      typeof v.startDate === 'string' &&
      typeof v.endDate === 'string' &&
      dateStr >= v.startDate &&
      dateStr <= v.endDate
  );
}

/**
 * Determines whether a habit is due on a specific YYYY-MM-DD date
 */
export function isHabitDueOnDate(habit: Habit, dateStr: string): boolean {
  if (isDateInVacation(dateStr, habit.vacationPeriods)) {
    return false;
  }

  if (habit.scheduleType === 'weekly_target') {
    return false;
  }

  if (
    habit.scheduleType === 'custom_days' &&
    Array.isArray(habit.customDays) &&
    habit.customDays.length > 0
  ) {
    const dayOfWeek = parseLocalDate(dateStr).getDay();
    return habit.customDays.includes(dayOfWeek);
  }

  return true;
}

export const HABIT_CATEGORIES = [
  'Study',
  'Health',
  'Fitness',
  'Mindfulness',
  'Finance',
  'Personal',
  'Other',
] as const;

export const HABIT_CATEGORY_COLORS: Record<string, string> = {
  study: '#3b82f6',
  health: '#f59e0b',
  fitness: '#ef4444',
  mindfulness: '#8b5cf6',
  finance: '#10b981',
  personal: '#ec4899',
  other: '#64748b',
  productivity: '#3b82f6',
  learning: '#8b5cf6',
};

export function getHabitCategoryColor(category?: string): string {
  const key = typeof category === 'string' ? category.trim().toLowerCase() : '';
  if (!key) return HABIT_CATEGORY_COLORS.personal;
  return HABIT_CATEGORY_COLORS[key] || HABIT_CATEGORY_COLORS.other;
}

export const WEEKDAYS_MON_FIRST: { day: number; label: string }[] = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 0, label: 'Sun' },
];

export function sortCustomDaysMonFirst(days?: number[]): number[] {
  if (!Array.isArray(days)) return [];
  const uniqueValid = Array.from(
    new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))
  );
  return uniqueValid.sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
}

export function formatCustomDaysLabel(days?: number[]): string {
  const ordered = sortCustomDaysMonFirst(days);
  if (ordered.length === 0) return 'Custom Days';
  return ordered
    .map((d) => WEEKDAYS_MON_FIRST.find((item) => item.day === d)?.label || '')
    .filter(Boolean)
    .join(' ');
}

function getMondayOfWeekStr(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  const daysSinceMonday = (d.getDay() + 6) % 7;
  return getLocalDateString(new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysSinceMonday));
}

export function getHabitTodayStatus(
  habit: Habit,
  todayStr: string = getLocalDateString()
): HabitTodayStatus {
  const completedDates = Array.isArray(habit.completedDates) ? habit.completedDates : [];
  if (completedDates.includes(todayStr)) {
    return 'COMPLETED';
  }
  if (isDateInVacation(todayStr, habit.vacationPeriods) || !isHabitDueOnDate(habit, todayStr)) {
    return 'REST';
  }
  return 'DUE';
}

function buildHealthClassification(strengthScore: number): Pick<
  HabitStrengthAnalysis,
  'healthLabel' | 'levelLabel' | 'levelBadgeColor' | 'resilienceRating'
> {
  if (strengthScore >= 85) {
    return {
      healthLabel: 'Excellent',
      levelLabel: 'Mastered 🏆',
      levelBadgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      resilienceRating: 'High',
    };
  }
  if (strengthScore >= 70) {
    return {
      healthLabel: 'Strong',
      levelLabel: 'Strong 💪',
      levelBadgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      resilienceRating: 'High',
    };
  }
  if (strengthScore >= 50) {
    return {
      healthLabel: 'Stable',
      levelLabel: 'Developing 📈',
      levelBadgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      resilienceRating: 'Moderate',
    };
  }
  if (strengthScore >= 25) {
    return {
      healthLabel: 'Building',
      levelLabel: 'Building ⚡',
      levelBadgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      resilienceRating: 'Developing',
    };
  }
  return {
    healthLabel: 'Needs focus',
    levelLabel: 'Needs Focus ⚠️',
    levelBadgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    resilienceRating: 'Needs Attention',
  };
}

/**
 * Canonical habit scoring and streak engine following Loop Habit Tracker's exponential decay model.
 * Computes streaks, strength (0-100), and completionRate (0-100) directly from `completedDates` —
 * never reads stale persisted `habit.streak`.
 */
export function getHabitStats(
  habit: Habit,
  todayStr: string = getLocalDateString()
): HabitStrengthAnalysis {
  const todayDate = parseLocalDate(todayStr);
  const uniqueDates = Array.from(
    new Set(Array.isArray(habit.completedDates) ? habit.completedDates : [])
  )
    .filter((d) => typeof d === 'string' && d <= todayStr)
    .sort();
  const completionSet = new Set(uniqueDates);

  const isOnVacationToday = isDateInVacation(todayStr, habit.vacationPeriods);
  const isDueToday = isHabitDueOnDate(habit, todayStr);

  // Determine start date for exponential score: earliest completion date (or createdAt if older, capped to 365 days)
  const earliestPossibleStr = getLocalDateOffset(-365, todayDate);
  let startStr = todayStr;
  if (uniqueDates.length > 0) {
    startStr = uniqueDates[0];
  } else if (typeof habit.createdAt === 'number' && Number.isFinite(habit.createdAt)) {
    const createdDate = new Date(habit.createdAt);
    if (!Number.isNaN(createdDate.getTime())) {
      const createdStr = getLocalDateString(createdDate);
      if (createdStr < startStr) startStr = createdStr;
    }
  }
  if (startStr < earliestPossibleStr) {
    startStr = earliestPossibleStr;
  }

  const targetPerWeek = Math.max(1, Math.min(7, habit.targetDaysPerWeek || 7));

  if (habit.scheduleType === 'weekly_target') {
    const freq = targetPerWeek / 7;
    const multiplier = Math.pow(0.5, Math.sqrt(freq) / 13);

    const startMondayStr = getMondayOfWeekStr(startStr);
    const currentMondayStr = getMondayOfWeekStr(todayStr);

    let score = 0;
    let runningStreak = 0;
    let bestStreak = 0;
    let checksThisWeek = 0;

    let weekCursor = parseLocalDate(startMondayStr);
    while (true) {
      const weekStartStr = getLocalDateString(weekCursor);
      if (weekStartStr > currentMondayStr) break;

      const isCurrentWeek = weekStartStr === currentMondayStr;
      const weekEndStr = getLocalDateOffset(6, weekCursor);
      const evalStartStr = weekStartStr < startStr ? startStr : weekStartStr;
      const evalEndStr = isCurrentWeek ? todayStr : weekEndStr;

      let checks = 0;
      let vacationDays = 0;
      let evalDays = 0;

      let dCursor = parseLocalDate(evalStartStr);
      while (true) {
        const dStr = getLocalDateString(dCursor);
        if (dStr > evalEndStr) break;
        evalDays++;
        if (completionSet.has(dStr)) {
          checks++;
        } else if (isDateInVacation(dStr, habit.vacationPeriods)) {
          vacationDays++;
        }
        dCursor = new Date(dCursor.getFullYear(), dCursor.getMonth(), dCursor.getDate() + 1);
      }

      const effectiveTarget = isCurrentWeek
        ? targetPerWeek
        : Math.min(targetPerWeek, Math.max(0, evalDays - vacationDays));

      if (isCurrentWeek) {
        checksThisWeek = checks;
        if (checks >= targetPerWeek) {
          const positiveDays = Math.max(checks, evalDays - vacationDays);
          for (let i = 0; i < positiveDays; i++) {
            score = score * multiplier + (1 - multiplier);
          }
          runningStreak++;
          if (runningStreak > bestStreak) bestStreak = runningStreak;
        } else {
          for (let i = 0; i < checks; i++) {
            score = score * multiplier + (1 - multiplier);
          }
        }
      } else {
        if (checks >= effectiveTarget) {
          const positiveDays = Math.max(checks, evalDays - vacationDays);
          for (let i = 0; i < positiveDays; i++) {
            score = score * multiplier + (1 - multiplier);
          }
          if (effectiveTarget > 0) {
            runningStreak++;
            if (runningStreak > bestStreak) bestStreak = runningStreak;
          }
        } else {
          for (let i = 0; i < checks; i++) {
            score = score * multiplier + (1 - multiplier);
          }
          const shortfall = Math.max(0, effectiveTarget - checks);
          for (let i = 0; i < shortfall; i++) {
            score = score * multiplier;
          }
          runningStreak = 0;
        }
      }

      weekCursor = new Date(
        weekCursor.getFullYear(),
        weekCursor.getMonth(),
        weekCursor.getDate() + 7
      );
    }

    const strengthScore = Math.min(100, Math.max(0, Math.round(score * 100)));
    const last28StartStr = getLocalDateOffset(-27, todayDate);
    const checksLast4Weeks = uniqueDates.filter(
      (d) => d >= last28StartStr && d <= todayStr
    ).length;
    const completionRate = Math.min(
      100,
      Math.max(0, Math.round((checksLast4Weeks / (4 * targetPerWeek)) * 100))
    );
    const backlogDays = Math.max(0, targetPerWeek - checksThisWeek);

    return {
      strengthScore,
      completionRate,
      monthlyCompletionRate: completionRate,
      currentStreak: runningStreak,
      bestStreak,
      backlogDays,
      isDueToday,
      isOnVacationToday,
      ...buildHealthClassification(strengthScore),
    };
  }

  // Daily and custom_days schedules
  const hasCustomDays =
    habit.scheduleType === 'custom_days' &&
    Array.isArray(habit.customDays) &&
    habit.customDays.length > 0;
  // Empty customDays behaves identically to daily (freq = 1)
  const multiplier = hasCustomDays
    ? Math.pow(0.5, 1 / (13 * (Math.max(1, Math.min(7, habit.customDays!.length)) / 7)))
    : Math.pow(0.5, 1 / 13);

  let score = 0;
  let runningStreak = 0;
  let bestStreak = 0;
  let currentStreak = 0;

  let evalDate = parseLocalDate(startStr);
  const totalEvalDays = Math.max(
    1,
    Math.round((todayDate.getTime() - evalDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );

  let missedDueDaysInWindow = 0;
  let completedLast30 = 0;
  let dueDaysLast30 = 0;
  const last30StartStr = getLocalDateOffset(-29, todayDate);
  const last7StartStr = getLocalDateOffset(-7, todayDate);

  for (let idx = 0; idx < totalEvalDays; idx++) {
    const dStr = getLocalDateString(evalDate);
    const isCompleted = completionSet.has(dStr);
    const isVacation = isDateInVacation(dStr, habit.vacationPeriods);
    const isDue = isHabitDueOnDate(habit, dStr);

    if (dStr >= last30StartStr) {
      if (isCompleted) completedLast30++;
      if (isDue || isCompleted) dueDaysLast30++;
    }

    if (isCompleted) {
      score = score * multiplier + (1 - multiplier);
      runningStreak++;
      if (runningStreak > bestStreak) bestStreak = runningStreak;
    } else if (isVacation || !isDue) {
      // Vacation / non-due days preserve both score and active streak
    } else {
      score = score * multiplier;
      if (dStr >= last7StartStr && dStr < todayStr) {
        missedDueDaysInWindow++;
      }
      // Yesterday grace: if today is not yet completed, keep yesterday's active streak
      if (dStr !== todayStr) {
        runningStreak = 0;
      }
    }

    if (dStr === todayStr) {
      currentStreak = runningStreak;
    }

    evalDate = new Date(evalDate.getFullYear(), evalDate.getMonth(), evalDate.getDate() + 1);
  }

  const strengthScore = Math.min(100, Math.max(0, Math.round(score * 100)));
  const completionRate =
    dueDaysLast30 > 0
      ? Math.min(100, Math.max(0, Math.round((completedLast30 / dueDaysLast30) * 100)))
      : 0;

  return {
    strengthScore,
    completionRate,
    monthlyCompletionRate: completionRate,
    currentStreak,
    bestStreak,
    backlogDays: missedDueDaysInWindow,
    isDueToday,
    isOnVacationToday,
    ...buildHealthClassification(strengthScore),
  };
}

/**
 * Alias preserved for backwards compatibility across views.
 */
export function analyzeHabitStrength(
  habit: Habit,
  todayStr: string = getLocalDateString()
): HabitStrengthAnalysis {
  return getHabitStats(habit, todayStr);
}
