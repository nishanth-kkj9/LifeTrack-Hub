export interface DailyMetricLike {
  date?: string;
  mood?: number;
  energy?: number;
  stress?: number;
  sleepHours?: number;
  steps?: number;
  workoutDone?: boolean;
}

export interface HabitLike {
  id?: string;
  name?: string;
  score?: {
    currentStrength?: number;
    completionRate?: number;
  };
}

export function summarizeWeeklyMetrics(metrics: DailyMetricLike[]) {
  if (!metrics.length) {
    return {
      mood: 0,
      energy: 0,
      stress: 0,
      sleep: 0,
      steps: 0,
      workouts: 0,
      completionRate: 0,
    };
  }

  const avgMood = metrics.reduce((sum, item) => sum + (item.mood ?? 0), 0) / metrics.length;
  const avgEnergy = metrics.reduce((sum, item) => sum + (item.energy ?? 0), 0) / metrics.length;
  const avgStress = metrics.reduce((sum, item) => sum + (item.stress ?? 0), 0) / metrics.length;
  const avgSleep = metrics.reduce((sum, item) => sum + (item.sleepHours ?? 0), 0) / metrics.length;
  const totalSteps = metrics.reduce((sum, item) => sum + (item.steps ?? 0), 0);
  const workouts = metrics.filter((item) => item.workoutDone).length;

  return {
    mood: Number(avgMood.toFixed(1)),
    energy: Number(avgEnergy.toFixed(1)),
    stress: Number(avgStress.toFixed(1)),
    sleep: Number(avgSleep.toFixed(1)),
    steps: totalSteps,
    workouts,
    completionRate: 80,
  };
}

export function buildWeeklySummary(habits: HabitLike[], metrics: DailyMetricLike[]) {
  const totalHabits = habits.length;
  const avgStrength = totalHabits
    ? habits.reduce((sum, habit) => sum + (habit.score?.currentStrength ?? 0), 0) / totalHabits
    : 0;

  const summary = summarizeWeeklyMetrics(metrics);

  return {
    totalHabits,
    averageStrength: Number(avgStrength.toFixed(1)),
    averageMood: summary.mood,
    averageEnergy: summary.energy,
    averageSleep: summary.sleep,
    completionRate: summary.completionRate,
    weeklyHighlights: [
      `You tracked ${metrics.length} days of life data this week.`,
      `Average energy is ${summary.energy}/5 and mood is ${summary.mood}/5.`,
      totalHabits
        ? `Your habit strength average is ${Number(avgStrength.toFixed(1))}/100.`
        : 'Create a few habits to get your first insights.',
    ],
  };
}

export function generateInsights(habits: HabitLike[], metrics: DailyMetricLike[]) {
  const summary = buildWeeklySummary(habits, metrics);

  const insights: string[] = [];

  if (summary.averageMood >= 4) {
    insights.push('Your mood trend is strong this week. Keep the routine stable.');
  } else {
    insights.push('Your mood is trending lower. Consider reducing overload and improving recovery.');
  }

  if (summary.averageSleep < 7) {
    insights.push('Sleep is below a healthy level. Try fixing your bedtime or reducing late-night work.');
  } else {
    insights.push('Sleep is in a healthy range and supports better consistency.');
  }

  if (summary.totalHabits === 0) {
    insights.push('Add your first few habits to start generating personalized recommendations.');
  } else {
    insights.push('Your habit system is active. Keep building consistency before trying to optimize everything.');
  }

  return insights;
}
