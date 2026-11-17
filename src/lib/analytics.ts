export interface DailyMetricLike {
  date?: string;
  mood?: number;
  moodLevel?: number;
  energy?: number;
  energyLevel?: number;
  stress?: number;
  stressLevel?: number;
  sleepHours?: number;
  steps?: number;
  stepsCount?: number;
  workoutDone?: boolean;
  deletedAt?: number;
}

export interface HabitLike {
  id?: string;
  name?: string;
  score?: {
    currentStrength?: number;
    completionRate?: number;
  };
}

function isFiniteNum(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function pickFinite(...values: Array<unknown>): number | undefined {
  for (const val of values) {
    if (isFiniteNum(val)) return val;
  }
  return undefined;
}

function averageDefined(values: Array<number | undefined>): { avg: number; count: number } {
  const valid = values.filter(isFiniteNum);
  if (valid.length === 0) return { avg: 0, count: 0 };
  const sum = valid.reduce((acc, v) => acc + v, 0);
  const avg = sum / valid.length;
  return {
    avg: Number.isFinite(avg) ? Number(avg.toFixed(1)) : 0,
    count: valid.length,
  };
}

export function summarizeWeeklyMetrics(metrics: DailyMetricLike[]) {
  const activeMetrics = (metrics || []).filter((m) => m && !m.deletedAt);
  if (!activeMetrics.length) {
    return {
      mood: 0,
      energy: 0,
      stress: 0,
      sleep: 0,
      steps: 0,
      workouts: 0,
      completionRate: 0,
      daysTracked: 0,
      moodCount: 0,
      energyCount: 0,
      stressCount: 0,
      sleepCount: 0,
    };
  }

  const validMetrics = activeMetrics.filter((m) => typeof m.date === 'string' && m.date.length > 0);
  const targetList = validMetrics.length ? validMetrics : activeMetrics;

  const moodStat = averageDefined(targetList.map((item) => pickFinite(item.mood, item.moodLevel)));
  const energyStat = averageDefined(targetList.map((item) => pickFinite(item.energy, item.energyLevel)));
  const stressStat = averageDefined(targetList.map((item) => pickFinite(item.stress, item.stressLevel)));
  const sleepStat = averageDefined(targetList.map((item) => pickFinite(item.sleepHours)));

  const totalSteps = targetList.reduce((sum, item) => {
    const val = pickFinite(item.steps, item.stepsCount);
    return sum + (val ?? 0);
  }, 0);
  const workouts = targetList.filter((item) => item.workoutDone === true).length;

  return {
    mood: moodStat.avg,
    energy: energyStat.avg,
    stress: stressStat.avg,
    sleep: sleepStat.avg,
    steps: totalSteps,
    workouts,
    // completionRate is habit-derived; metrics alone cannot produce it.
    // Real value is computed in buildWeeklySummary() from habit scores.
    completionRate: 0,
    daysTracked: targetList.length,
    moodCount: moodStat.count,
    energyCount: energyStat.count,
    stressCount: stressStat.count,
    sleepCount: sleepStat.count,
  };
}

export function buildWeeklySummary(habits: HabitLike[], metrics: DailyMetricLike[]) {
  const totalHabits = habits.length;
  const avgStrength = totalHabits
    ? habits.reduce((sum, habit) => {
        const s = habit.score?.currentStrength;
        return sum + (isFiniteNum(s) ? s : 0);
      }, 0) / totalHabits
    : 0;

  const summary = summarizeWeeklyMetrics(metrics);

  // REAL completion rate: average of per-habit completionRate when available,
  // falling back to strength score. No hardcoded constants.
  const realCompletionRate = totalHabits
    ? habits.reduce((sum, h) => {
        const val = pickFinite(h.score?.completionRate, h.score?.currentStrength);
        return sum + (val ?? 0);
      }, 0) / totalHabits
    : 0;

  let moodEnergyHighlight: string;
  if (summary.energyCount > 0 && summary.moodCount > 0) {
    moodEnergyHighlight = `Average energy is ${summary.energy}/5 and mood is ${summary.mood}/5.`;
  } else if (summary.moodCount > 0) {
    moodEnergyHighlight = `Average mood is ${summary.mood}/5.`;
  } else if (summary.energyCount > 0) {
    moodEnergyHighlight = `Average energy is ${summary.energy}/5.`;
  } else {
    moodEnergyHighlight = 'Log daily mood or energy check-ins to track your well-being averages.';
  }

  return {
    totalHabits,
    averageStrength: Number.isFinite(avgStrength) ? Number(avgStrength.toFixed(1)) : 0,
    averageMood: summary.mood,
    averageEnergy: summary.energy,
    averageSleep: summary.sleep,
    moodCount: summary.moodCount,
    energyCount: summary.energyCount,
    stressCount: summary.stressCount,
    sleepCount: summary.sleepCount,
    completionRate: Number.isFinite(realCompletionRate) ? Number(realCompletionRate.toFixed(1)) : 0,
    weeklyHighlights: [
      `You tracked ${summary.daysTracked} days of life data this week.`,
      moodEnergyHighlight,
      totalHabits
        ? `Your habit strength average is ${Number.isFinite(avgStrength) ? Number(avgStrength.toFixed(1)) : 0}/100.`
        : 'Create a few habits to get your first insights.',
    ],
  };
}

export function generateInsights(habits: HabitLike[], metrics: DailyMetricLike[]): string[] {
  const summary = buildWeeklySummary(habits, metrics);
  const insights: string[] = [];

  if (summary.moodCount > 0) {
    if (summary.averageMood >= 4) {
      insights.push('✅ Your mood trend is strong this week. Keep the routine stable.');
    } else if (summary.averageMood >= 2) {
      insights.push('⚠️ Your mood is trending lower. Consider reducing overload and improving recovery.');
    } else {
      insights.push('🔴 Mood is significantly low. Prioritize self-care and stress management.');
    }
  }

  if (summary.sleepCount > 0) {
    if (summary.averageSleep >= 7) {
      insights.push('✅ Sleep is in a healthy range and supports better consistency.');
    } else if (summary.averageSleep >= 5) {
      insights.push('⚠️ Sleep is below 7 hours. Try fixing your bedtime to improve recovery.');
    } else {
      insights.push('🔴 Sleep is critically low. Urgent: Prioritize rest and recovery.');
    }
  }

  if (summary.energyCount > 0) {
    if (summary.averageEnergy >= 4) {
      insights.push('⚡ Your energy levels are excellent. This is the time to push harder.');
    } else if (summary.averageEnergy < 2) {
      insights.push('🔋 Energy is low. Consider rest days and lighter workouts.');
    }
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
  const moodEntries = (metrics || [])
    .filter((m) => m && !m.deletedAt)
    .map((m) => ({
      date: m.date || '',
      mood: pickFinite(m.mood, m.moodLevel),
    }))
    .filter((m): m is { date: string; mood: number } => m.mood !== undefined);

  if (moodEntries.length < 2) return { trend: 'stable', change: 0 };

  const sorted = [...moodEntries].sort((a, b) => a.date.localeCompare(b.date));
  const mid = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, mid);
  const secondHalf = sorted.slice(mid);

  const firstAvg = firstHalf.reduce((sum, m) => sum + m.mood, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, m) => sum + m.mood, 0) / secondHalf.length;

  const change = secondAvg - firstAvg;
  if (!Number.isFinite(change)) return { trend: 'stable', change: 0 };
  const trend = change > 0.5 ? 'improving' : change < -0.5 ? 'declining' : 'stable';

  return { trend, change: Number(change.toFixed(1)) };
}

