export interface HabitScoreInput {
  completions: number;
  totalDueDates: number;
  currentStreak: number;
  longestStreak: number;
}

export interface HabitScoreResult {
  currentStrength: number;
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
  backlogDays: number;
  healthLabel: 'Excellent' | 'Strong' | 'Stable' | 'Needs attention';
}

export function calculateHabitScore({
  completions,
  totalDueDates,
  currentStreak,
  longestStreak,
}: HabitScoreInput): HabitScoreResult {
  const completionRate = totalDueDates === 0 ? 0 : (completions / totalDueDates) * 100;

  const consistencyBoost = Math.min(currentStreak * 2.5, 30);
  const longevityBoost = Math.min(longestStreak * 1.2, 20);
  const completionBoost = completionRate * 0.6;
  const strength = Math.min(
    100,
    Math.max(0, completionBoost + consistencyBoost + longevityBoost)
  );

  const backlogDays = totalDueDates === 0 ? 0 : Math.max(0, totalDueDates - completions);

  let healthLabel: HabitScoreResult['healthLabel'] = 'Needs attention';
  if (strength >= 80) healthLabel = 'Excellent';
  else if (strength >= 60) healthLabel = 'Strong';
  else if (strength >= 35) healthLabel = 'Stable';

  return {
    currentStrength: Number(strength.toFixed(1)),
    completionRate: Number(completionRate.toFixed(1)),
    currentStreak,
    longestStreak,
    backlogDays,
    healthLabel,
  };
}

export function calculateOverallCompletionRate<T extends { score: { completionRate: number } }>(items: T[]) {
  if (!items.length) return 0;
  return items.reduce((sum, item) => sum + item.score.completionRate, 0) / items.length;
}
