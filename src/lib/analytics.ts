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
      daysTracked: 0,
    };
  }

  const validMetrics = metrics.filter((m) => m.date);
  const targetList = validMetrics.length ? validMetrics : metrics;
  const avgMood = targetList.reduce((sum, item) => sum + (item.mood ?? 0), 0) / targetList.length;
  const avgEnergy = targetList.reduce((sum, item) => sum + (item.energy ?? 0), 0) / targetList.length;
  const avgStress = targetList.reduce((sum, item) => sum + (item.stress ?? 0), 0) / targetList.length;
  const avgSleep = targetList.reduce((sum, item) => sum + (item.sleepHours ?? 0), 0) / targetList.length;
  const totalSteps = targetList.reduce((sum, item) => sum + (item.steps ?? 0), 0);
  const workouts = targetList.filter((item) => item.workoutDone).length;

  return {
    mood: Number(avgMood.toFixed(1)),
    energy: Number(avgEnergy.toFixed(1)),
    stress: Number(avgStress.toFixed(1)),
    sleep: Number(avgSleep.toFixed(1)),
    steps: totalSteps,
    workouts,
    completionRate: 80,
    daysTracked: targetList.length,
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
      `You tracked ${summary.daysTracked} days of life data this week.`,
      `Average energy is ${summary.energy}/5 and mood is ${summary.mood}/5.`,
      totalHabits
        ? `Your habit strength average is ${Number(avgStrength.toFixed(1))}/100.`
        : 'Create a few habits to get your first insights.',
    ],
  };
}

export function generateInsights(habits: HabitLike[], metrics: DailyMetricLike[]): string[] {
  const summary = buildWeeklySummary(habits, metrics);
  const insights: string[] = [];

  if (summary.averageMood >= 4) {
    insights.push('✅ Your mood trend is strong this week. Keep the routine stable.');
  } else if (summary.averageMood >= 2) {
    insights.push('⚠️ Your mood is trending lower. Consider reducing overload and improving recovery.');
  } else {
    insights.push('🔴 Mood is significantly low. Prioritize self-care and stress management.');
  }

  if (summary.averageSleep >= 7) {
    insights.push('✅ Sleep is in a healthy range and supports better consistency.');
  } else if (summary.averageSleep >= 5) {
    insights.push('⚠️ Sleep is below 7 hours. Try fixing your bedtime to improve recovery.');
  } else {
    insights.push('🔴 Sleep is critically low. Urgent: Prioritize rest and recovery.');
  }

  if (summary.averageEnergy >= 4) {
    insights.push('⚡ Your energy levels are excellent. This is the time to push harder.');
  } else if (summary.averageEnergy < 2) {
    insights.push('🔋 Energy is low. Consider rest days and lighter workouts.');
  }

  if (summary.totalHabits === 0) {
    insights.push('📌 Add your first few habits to start generating personalized recommendations.');
  } else if (summary.completionRate >= 80) {
    insights.push('🎯 Completion rate is excellent. You are building strong consistency.');
  } else if (summary.completionRate < 50) {
    insights.push('📊 Completion rate is low. Consider reducing habit count or adjusting schedule.');
  }

  return insights;
}

export function getWeeklyTrend(metrics: DailyMetricLike[]): { trend: 'improving' | 'stable' | 'declining'; change: number } {
  if (metrics.length < 2) return { trend: 'stable', change: 0 };

  const sorted = [...metrics].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
  const secondHalf = sorted.slice(Math.floor(sorted.length / 2));

  const firstAvg = firstHalf.reduce((sum, m) => sum + (m.mood ?? 0), 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, m) => sum + (m.mood ?? 0), 0) / secondHalf.length;

  const change = secondAvg - firstAvg;
  const trend = change > 0.5 ? 'improving' : change < -0.5 ? 'declining' : 'stable';

  return { trend, change: Number(change.toFixed(1)) };
}
