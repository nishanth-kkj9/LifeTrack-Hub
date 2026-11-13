import { Habit, VacationPeriod } from '../types/index.ts';
import { getLocalDateString, getLocalDateOffset, parseLocalDate } from './dateUtils.ts';

export interface HabitStrengthAnalysis {
  strengthScore: number; // 0-100
  completionRate: number; // 0-100 (clamped)
  monthlyCompletionRate: number; // 0-100%
  currentStreak: number;
  bestStreak: number;
  backlogDays: number;
  isDueToday: boolean;
  isOnVacationToday: boolean;
  healthLabel: 'Excellent' | 'Strong' | 'Stable' | 'Needs attention';
  levelLabel: string;
  levelBadgeColor: string;
  resilienceRating: 'High' | 'Moderate' | 'Developing' | 'Needs Attention';
}

/**
 * Checks if a given YYYY-MM-DD date falls within any active vacation period
 */
export function isDateInVacation(dateStr: string, vacationPeriods?: VacationPeriod[]): boolean {
  if (!vacationPeriods || vacationPeriods.length === 0) return false;
  return vacationPeriods.some(
    (v) => dateStr >= v.startDate && dateStr <= v.endDate
  );
}

/**
 * Determines whether a habit is due on a specific YYYY-MM-DD date
 */
export function isHabitDueOnDate(habit: Habit, dateStr: string): boolean {
  if (isDateInVacation(dateStr, habit.vacationPeriods)) {
    return false;
  }

  if (habit.scheduleType === 'custom_days' && habit.customDays && habit.customDays.length > 0) {
    const dayOfWeek = parseLocalDate(dateStr).getDay();
    return habit.customDays.includes(dayOfWeek);
  }

  return true;
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
  const uniqueDates = Array.from(new Set(habit.completedDates || []))
    .filter((d) => d <= todayStr)
    .sort();
  const completionSet = new Set(uniqueDates);

  const isOnVacationToday = isDateInVacation(todayStr, habit.vacationPeriods);
  const isDueToday = isHabitDueOnDate(habit, todayStr);

  // Determine start date for exponential score: earliest completion date (or createdAt if older, capped to 365 days)
  const earliestPossibleStr = getLocalDateOffset(-365, todayDate);
  let startStr = todayStr;
  if (uniqueDates.length > 0) {
    startStr = uniqueDates[0];
  } else if (habit.createdAt) {
    const createdStr = getLocalDateString(new Date(habit.createdAt));
    if (createdStr < startStr) startStr = createdStr;
  }
  if (startStr < earliestPossibleStr) {
    startStr = earliestPossibleStr;
  }

  // Loop formula: multiplier = 0.5 ^ (sqrt(freq) / 13)
  // For daily habits (freq = 1): 30 consecutive completions -> ~80%, 60 -> ~96%, 90 -> ~99%.
  const targetPerWeek = Math.max(1, Math.min(7, habit.targetDaysPerWeek || 7));
  const freq = habit.scheduleType === 'custom_days' && habit.customDays?.length
    ? Math.max(1, Math.min(7, habit.customDays.length)) / 7
    : targetPerWeek / 7;
  const multiplier = Math.pow(0.5, Math.sqrt(freq) / 13);

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
      if (dStr < todayStr) {
        missedDueDaysInWindow++;
      }
      // Yesterday grace: breaking streak only happens for days strictly before todayStr unless today breaks it?
      // Wait: if today is not yet completed, currentStreak stays equal to yesterday's active streak!
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

  // Completion rate over last 30 days (or active span >= 7 days) clamped [0, 100]
  let completionRate = 0;
  if (habit.scheduleType === 'weekly_target' || (!habit.scheduleType && targetPerWeek < 7)) {
    const windowDays = Math.min(30, Math.max(7, totalEvalDays));
    const expectedCompletions = (windowDays / 7) * targetPerWeek;
    completionRate =
      expectedCompletions > 0
        ? Math.min(100, Math.max(0, Math.round((completedLast30 / expectedCompletions) * 100)))
        : 0;
  } else {
    completionRate =
      dueDaysLast30 > 0
        ? Math.min(100, Math.max(0, Math.round((completedLast30 / dueDaysLast30) * 100)))
        : 0;
  }

  // Health & badge classification
  let healthLabel: HabitStrengthAnalysis['healthLabel'] = 'Needs attention';
  if (strengthScore >= 80) healthLabel = 'Excellent';
  else if (strengthScore >= 60) healthLabel = 'Strong';
  else if (strengthScore >= 35) healthLabel = 'Stable';

  let levelLabel = 'Needs Focus ⚠️';
  let levelBadgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
  let resilienceRating: HabitStrengthAnalysis['resilienceRating'] = 'Needs Attention';

  if (strengthScore >= 85) {
    levelLabel = 'Mastered 🏆';
    levelBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    resilienceRating = 'High';
  } else if (strengthScore >= 70) {
    levelLabel = 'Strong 💪';
    levelBadgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
    resilienceRating = 'High';
  } else if (strengthScore >= 50) {
    levelLabel = 'Developing 📈';
    levelBadgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-200';
    resilienceRating = 'Moderate';
  } else if (strengthScore >= 25) {
    levelLabel = 'Building ⚡';
    levelBadgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
    resilienceRating = 'Developing';
  }

  return {
    strengthScore,
    completionRate,
    monthlyCompletionRate: completionRate,
    currentStreak,
    bestStreak,
    backlogDays: missedDueDaysInWindow,
    isDueToday,
    isOnVacationToday,
    healthLabel,
    levelLabel,
    levelBadgeColor,
    resilienceRating,
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
