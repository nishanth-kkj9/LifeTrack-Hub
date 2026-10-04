import { Habit, VacationPeriod } from '../types/index.ts';
import { getLocalDateString, getLocalDateOffset } from './dateUtils.ts';

export interface HabitStrengthAnalysis {
  strengthScore: number; // 0-100
  levelLabel: string;
  levelBadgeColor: string;
  currentStreak: number;
  bestStreak: number;
  isDueToday: boolean;
  isOnVacationToday: boolean;
  monthlyCompletionRate: number; // 0-100%
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
  // Vacation days are explicitly paused / not due
  if (isDateInVacation(dateStr, habit.vacationPeriods)) {
    return false;
  }

  // Schedule type checking
  if (habit.scheduleType === 'custom_days' && habit.customDays && habit.customDays.length > 0) {
    const dayOfWeek = new Date(dateStr + 'T00:00:00').getDay();
    return habit.customDays.includes(dayOfWeek);
  }

  return true;
}

/**
 * Calculates exponential habit strength (0-100%) and intelligent streak following Loop Habit Tracker algorithm.
 * Recent completions carry heavier weight, missed due days cause gentle decay, and non-due/vacation days do not decay strength.
 */
export function analyzeHabitStrength(
  habit: Habit,
  todayStr: string = getLocalDateString(),
  evaluationDays: number = 60
): HabitStrengthAnalysis {
  let score = 0.2; // Baseline 20% starting strength
  const completionSet = new Set(habit.completedDates || []);

  const isOnVacationToday = isDateInVacation(todayStr, habit.vacationPeriods);
  const isDueToday = isHabitDueOnDate(habit, todayStr);

  let totalDueDaysLast30 = 0;
  let completedDueDaysLast30 = 0;

  // Evaluate day-by-day chronologically from evaluationDays ago up to today
  for (let i = evaluationDays; i >= 0; i--) {
    const dStr = getLocalDateOffset(-i);
    const isCompleted = completionSet.has(dStr);
    const isVacation = isDateInVacation(dStr, habit.vacationPeriods);
    const isDue = isHabitDueOnDate(habit, dStr);

    if (i <= 30 && (isDue || isCompleted)) {
      totalDueDaysLast30++;
      if (isCompleted) completedDueDaysLast30++;
    }

    if (isCompleted) {
      // Completion increases strength smoothly towards 1.0 (0.16 bonus)
      score = score + (1.0 - score) * 0.16;
    } else if (isVacation) {
      // Vacation days preserve current strength
      score = score * 1.0;
    } else if (isDue) {
      // Missed due day decays strength by 6%
      score = score * (1.0 - 0.06);
    }
  }

  const finalStrength = Math.min(100, Math.max(0, Math.round(score * 100)));

  // Calculate intelligent streak (non-due days and vacation days do NOT break streak)
  let currentStreak = 0;
  let bestStreak = 0;
  let runningStreak = 0;

  for (let i = 180; i >= 0; i--) {
    const dStr = getLocalDateOffset(-i);
    const isCompleted = completionSet.has(dStr);
    const isVacation = isDateInVacation(dStr, habit.vacationPeriods);
    const isDue = isHabitDueOnDate(habit, dStr);

    if (isCompleted) {
      runningStreak++;
      if (runningStreak > bestStreak) bestStreak = runningStreak;
    } else if (isVacation || !isDue) {
      // Non-due / vacation days maintain active streak momentum
      if (runningStreak > 0) {
        // Keep running streak intact
      }
    } else {
      // Missed due day breaks active streak
      runningStreak = 0;
    }

    if (dStr === todayStr) {
      currentStreak = runningStreak;
    }
  }

  // Level classification
  let levelLabel = 'Starting 🌱';
  let levelBadgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
  let resilienceRating: HabitStrengthAnalysis['resilienceRating'] = 'Developing';

  if (finalStrength >= 85) {
    levelLabel = 'Mastered 🏆';
    levelBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    resilienceRating = 'High';
  } else if (finalStrength >= 70) {
    levelLabel = 'Strong 💪';
    levelBadgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
    resilienceRating = 'High';
  } else if (finalStrength >= 50) {
    levelLabel = 'Developing 📈';
    levelBadgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-200';
    resilienceRating = 'Moderate';
  } else if (finalStrength >= 25) {
    levelLabel = 'Building ⚡';
    levelBadgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
    resilienceRating = 'Developing';
  } else {
    levelLabel = 'Needs Focus ⚠️';
    levelBadgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
    resilienceRating = 'Needs Attention';
  }

  const monthlyCompletionRate =
    totalDueDaysLast30 > 0
      ? Math.round((completedDueDaysLast30 / totalDueDaysLast30) * 100)
      : 0;

  return {
    strengthScore: finalStrength,
    levelLabel,
    levelBadgeColor,
    currentStreak: Math.max(currentStreak, habit.streak || 0),
    bestStreak: Math.max(bestStreak, habit.bestStreak || 0, currentStreak),
    isDueToday,
    isOnVacationToday,
    monthlyCompletionRate,
    resilienceRating,
  };
}
