# LifeTrack-Hub Implementation Files

This file contains the implementation code for the improved habit intelligence system inspired by Loop Habit Tracker, Routine Tracker, and FxLifeSheet.

## 1) src/lib/habitScore.ts

```ts
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
```

## 2) src/lib/schedule.ts

```ts
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
```

## 3) src/lib/analytics.ts

```ts
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
```

## 4) src/features/dashboard/LifeDashboard.tsx

```tsx
import React from 'react';

export interface DashboardCardProps {
  title: string;
  value: string;
  subtitle?: string;
  accent?: string;
}

function DashboardCard({ title, value, subtitle, accent = '#7c3aed' }: DashboardCardProps) {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 18,
        padding: 18,
        minHeight: 120,
        boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
      }}
    >
      <div style={{ fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', opacity: 0.7 }}>{title}</div>
      <div
        style={{
          marginTop: 12,
          fontSize: 28,
          fontWeight: 700,
          color: accent,
        }}
      >
        {value}
      </div>
      {subtitle ? (
        <div style={{ marginTop: 8, fontSize: 13, opacity: 0.75 }}>{subtitle}</div>
      ) : null}
    </div>
  );
}

export interface LifeDashboardProps {
  totalHabits?: number;
  completionRate?: number;
  averageMood?: number;
  averageEnergy?: number;
  averageSleep?: number;
  insights?: string[];
  className?: string;
}

export function LifeDashboard({
  totalHabits = 0,
  completionRate = 0,
  averageMood = 0,
  averageEnergy = 0,
  averageSleep = 0,
  insights = [],
  className = '',
}: LifeDashboardProps) {
  return (
    <div className={className} style={{ display: 'grid', gap: 18 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
        }}
      >
        <DashboardCard title="Habits" value={String(totalHabits)} subtitle="Active routines" accent="#8b5cf6" />
        <DashboardCard title="Completion" value={`${completionRate.toFixed(0)}%`} subtitle="Weekly average" accent="#22c55e" />
        <DashboardCard title="Mood" value={`${averageMood.toFixed(1)}/5`} subtitle="Tracked sentiment" accent="#f59e0b" />
        <DashboardCard title="Energy" value={`${averageEnergy.toFixed(1)}/5`} subtitle="Current rhythm" accent="#06b6d4" />
        <DashboardCard title="Sleep" value={`${averageSleep.toFixed(1)}h`} subtitle="Average nightly sleep" accent="#ef4444" />
      </div>

      <div
        style={{
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: 18,
          padding: 20,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Life Insights</div>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 10 }}>
          {insights.length ? (
            insights.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)
          ) : (
            <li>Add your first metrics to see personalized insights.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

export default LifeDashboard;
```

## 5) src/types/tracking.ts

```ts
export enum HabitScheduleType {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  CUSTOM_PATTERN = 'CUSTOM_PATTERN',
  CUSTOM_DATES = 'CUSTOM_DATES',
}

export enum HabitStatus {
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  DUE = 'DUE',
  NOT_DUE = 'NOT_DUE',
  SKIPPED = 'SKIPPED',
}

export interface HabitSchedule {
  type: HabitScheduleType;
  startDate: string;
  endDate?: string;
  daysOfWeek?: number[];
  timesPerWeek?: number;
  daysOfMonth?: number[];
  timesPerMonth?: number;
  pattern?: string;
  specificDates?: string[];
}

export interface HabitScore {
  currentStrength: number;
  longestStreak: number;
  currentStreak: number;
  completionRate: number;
  backlogDays: number;
  updatedAt: string;
}

export interface Habit {
  id: string;
  name: string;
  description?: string;
  category: 'fitness' | 'health' | 'productivity' | 'learning' | 'finance' | 'personal';
  color?: string;
  schedule: HabitSchedule;
  reminderTime?: string;
  notificationEnabled: boolean;
  score: HabitScore;
  createdAt: string;
  updatedAt: string;
}

export interface HabitCompletion {
  id: string;
  habitId: string;
  completedDate: string;
  completedTimestamp: string;
  numTimesCompleted: number;
}

export interface DailyMetric {
  id: string;
  date: string;
  mood: number;
  energy: number;
  stress: number;
  sleepHours: number;
  sleepQuality: number;
  workoutDone: boolean;
  steps: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

## Summary

These files are the current implementation foundation for upgrading LifeTrack-Hub into a stronger habit-based life dashboard.

Use them directly in your project root and integrate them into your existing screens.
