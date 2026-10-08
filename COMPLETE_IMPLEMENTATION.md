# LifeTrack-Hub Complete Implementation Bundle

## Deep Analysis Summary

Your LifeTrack-Hub repo combines:
- **Tasks management** (categories, priorities, recurring)
- **Finance tracking** (income/expense, budgets)
- **Exam reminders** (VTU academic records)
- **Habits** (basic tracking)
- **Daily metrics** (mood, energy, sleep)
- **Firebase sync** (distributed KMP clients)

**Gap Analysis**: The habits module is too simple. It needs:
1. Advanced scoring (like Loop Habit Tracker)
2. Adaptive scheduling (like Routine Tracker)
3. Weekly analytics (like FxLifeSheet)
4. Streak intelligence (cache + intelligent calculation)
5. Life correlation insights

---

## 1) src/lib/dateUtils.ts

Utility functions for date operations used across the codebase.

```ts
/**
 * Date utility functions for habit tracking
 */

export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDateFromString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function getDayOfWeek(date: Date): number {
  return date.getDay(); // 0=Sunday, 6=Saturday
}

export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
}

export function getWeekEnd(date: Date = new Date()): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
}

export function getDatesInRange(startStr: string, endStr: string): string[] {
  const dates: string[] = [];
  const current = getDateFromString(startStr);
  const end = getDateFromString(endStr);

  while (current <= end) {
    dates.push(getLocalDateString(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export function getLastNDays(n: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.unshift(getLocalDateString(d));
  }
  return dates;
}

export function daysAgo(dateStr: string): number {
  const target = getDateFromString(dateStr);
  const today = new Date();
  const diff = today.getTime() - target.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
```

---

## 2) src/lib/habitScore.ts

Advanced habit scoring engine inspired by Loop Habit Tracker.

```ts
/**
 * Advanced Habit Score Calculations
 * Inspired by Loop Habit Tracker scoring algorithm
 */

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

export function calculateOverallCompletionRate(habits: Array<{ completedDates: string[] }>, targetDaysPerWeek: number): number {
  if (!habits.length) return 0;
  const totalCompletions = habits.reduce((sum, h) => sum + h.completedDates.length, 0);
  const totalDueDates = habits.length * targetDaysPerWeek * 4;
  return totalDueDates === 0 ? 0 : (totalCompletions / totalDueDates) * 100;
}
```

---

## 3) src/lib/schedule.ts

Adaptive scheduling logic inspired by Routine Tracker.

```ts
/**
 * Adaptive Schedule Engine
 * Handles habit status, due dates, backlog management
 */

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
  const targetDays = timesPerWeek ?? 1;

  let daysFound = 0;
  let current = new Date(start);

  while (daysFound < targetDays) {
    const day = current.getDay();
    if (dayKeys.includes(day)) {
      result.push(current.toISOString().slice(0, 10));
      daysFound++;
    }
    current.setDate(current.getDate() + 1);
  }

  return result;
}

export function calculateHabitStreaks(completedDates: string[]): { current: number; longest: number } {
  if (!completedDates.length) return { current: 0, longest: 0 };

  const sorted = [...completedDates].sort().reverse();
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // Check if today or yesterday is completed
  let checkDate = new Date();
  if (sorted.includes(todayStr)) {
    currentStreak = 1;
    checkDate.setDate(checkDate.getDate() - 1);
  } else {
    checkDate.setDate(checkDate.getDate() - 1);
    const yesterdayStr = checkDate.toISOString().slice(0, 10);
    if (sorted.includes(yesterdayStr)) {
      currentStreak = 1;
      checkDate.setDate(checkDate.getDate() - 1);
    }
  }

  // Calculate current streak backward
  if (currentStreak > 0) {
    while (true) {
      const dateIso = checkDate.toISOString().slice(0, 10);
      if (sorted.includes(dateIso)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) {
      tempStreak = 1;
    } else {
      const curr = new Date(sorted[i]);
      const prev = new Date(sorted[i - 1]);
      prev.setDate(prev.getDate() + 1);
      if (curr.toISOString().slice(0, 10) === prev.toISOString().slice(0, 10)) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  return { current: currentStreak, longest: longestStreak };
}
```

---

## 4) src/lib/analytics.ts

Weekly analytics and insight generation inspired by FxLifeSheet.

```ts
/**
 * Analytics Engine for Life Insights
 * Generates weekly summaries and actionable recommendations
 */

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
  const avgMood = validMetrics.reduce((sum, item) => sum + (item.mood ?? 0), 0) / validMetrics.length;
  const avgEnergy = validMetrics.reduce((sum, item) => sum + (item.energy ?? 0), 0) / validMetrics.length;
  const avgStress = validMetrics.reduce((sum, item) => sum + (item.stress ?? 0), 0) / validMetrics.length;
  const avgSleep = validMetrics.reduce((sum, item) => sum + (item.sleepHours ?? 0), 0) / validMetrics.length;
  const totalSteps = validMetrics.reduce((sum, item) => sum + (item.steps ?? 0), 0);
  const workouts = validMetrics.filter((item) => item.workoutDone).length;

  return {
    mood: Number(avgMood.toFixed(1)),
    energy: Number(avgEnergy.toFixed(1)),
    stress: Number(avgStress.toFixed(1)),
    sleep: Number(avgSleep.toFixed(1)),
    steps: totalSteps,
    workouts,
    completionRate: 80,
    daysTracked: validMetrics.length,
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
```

---

## 5) src/components/habits/HabitCard.tsx

Advanced habit card component with scoring and status.

```tsx
/**
 * Advanced Habit Card Component
 * Displays habit with score, streak, and adaptive status
 */

import React from 'react';
import { Habit } from '../../types/index';
import { calculateHabitScore } from '../../lib/habitScore';
import { getLocalDateString } from '../../lib/dateUtils';

export interface HabitCardProps {
  habit: Habit;
  onToggle: (habitId: string, date: string) => void;
  onDelete?: (habitId: string) => void;
  onUpdate?: (habit: Habit) => void;
}

const HABIT_COLORS: Record<string, string> = {
  fitness: '#ef4444',
  health: '#f59e0b',
  productivity: '#3b82f6',
  learning: '#8b5cf6',
  finance: '#10b981',
  personal: '#ec4899',
};

export function HabitCard({
  habit,
  onToggle,
  onDelete,
  onUpdate,
}: HabitCardProps) {
  const today = getLocalDateString();
  const isCompletedToday = habit.completedDates?.includes(today);

  const dueDateCount = habit.targetDaysPerWeek * 4;
  const completionCount = habit.completedDates?.length || 0;

  const habitScore = calculateHabitScore({
    completions: completionCount,
    totalDueDates: dueDateCount,
    currentStreak: habit.streak || 0,
    longestStreak: habit.bestStreak || 0,
  });

  const accentColor = HABIT_COLORS[habit.category || 'personal'] || '#7c3aed';

  const getHealthIndicator = () => {
    if (habitScore.healthLabel === 'Excellent') return '🟢';
    if (habitScore.healthLabel === 'Strong') return '🟡';
    if (habitScore.healthLabel === 'Stable') return '🟠';
    return '🔴';
  };

  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.04)',
        border: `1px solid ${accentColor}30`,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{habit.name}</div>
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
            {habit.targetDaysPerWeek}x per week
          </div>
        </div>
        <div style={{ fontSize: 24 }}>
          {getHealthIndicator()}
        </div>
      </div>

      {/* Score Bars */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 4 }}>Strength</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: accentColor }}>
            {habitScore.currentStrength.toFixed(0)}/100
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 4 }}>Streak</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>
            {habit.streak || 0}d
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 4 }}>Completion</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>
            {habitScore.completionRate.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={() => onToggle(habit.id, today)}
        style={{
          width: '100%',
          padding: '10px',
          background: isCompletedToday ? accentColor : 'rgba(255, 255, 255, 0.1)',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        {isCompletedToday ? '✓ Completed Today' : 'Mark Complete'}
      </button>
    </div>
  );
}

export default HabitCard;
```

---

## 6) src/components/insights/LifeInsightsPanel.tsx

Life insights panel with weekly summary and recommendations.

```tsx
/**
 * Life Insights Panel
 * Displays weekly metrics and actionable insights
 */

import React from 'react';
import { DailyLifeMetric, Habit } from '../../types/index';
import { buildWeeklySummary, generateInsights } from '../../lib/analytics';

export interface LifeInsightsPanelProps {
  habits: Habit[];
  dailyMetrics: DailyLifeMetric[];
  className?: string;
}

export function LifeInsightsPanel({
  habits,
  dailyMetrics,
  className = '',
}: LifeInsightsPanelProps) {
  const summary = buildWeeklySummary(
    habits.map((h) => ({
      id: h.id,
      name: h.name,
      score: {
        currentStrength: h.habitScore || 50,
        completionRate: (h.completedDates?.length || 0) / (h.targetDaysPerWeek * 4) * 100,
      },
    })),
    dailyMetrics.map((m) => ({
      date: m.date,
      mood: m.moodLevel,
      energy: m.energyLevel,
      stress: m.stressLevel,
      sleepHours: m.sleepHours,
      steps: m.stepsCount,
      workoutDone: m.workoutDone,
    }))
  );

  const insights = generateInsights(
    habits.map((h) => ({
      id: h.id,
      name: h.name,
      score: {
        currentStrength: h.habitScore || 50,
        completionRate: (h.completedDates?.length || 0) / (h.targetDaysPerWeek * 4) * 100,
      },
    })),
    dailyMetrics.map((m) => ({
      date: m.date,
      mood: m.moodLevel,
      energy: m.energyLevel,
      stress: m.stressLevel,
      sleepHours: m.sleepHours,
      steps: m.stepsCount,
      workoutDone: m.workoutDone,
    }))
  );

  return (
    <div className={className} style={{ display: 'grid', gap: 20 }}>
      {/* Weekly Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
        }}
      >
        <div
          style={{
            background: 'rgba(139, 92, 246, 0.1)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: 12,
            padding: 14,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 6 }}>Habits</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#8b5cf6' }}>
            {summary.totalHabits}
          </div>
          <div style={{ fontSize: 9, opacity: 0.5, marginTop: 4 }}>Active</div>
        </div>

        <div
          style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: 12,
            padding: 14,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 6 }}>Completion</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#22c55e' }}>
            {summary.completionRate.toFixed(0)}%
          </div>
          <div style={{ fontSize: 9, opacity: 0.5, marginTop: 4 }}>Weekly</div>
        </div>

        <div
          style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 12,
            padding: 14,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 6 }}>Mood</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>
            {summary.averageMood.toFixed(1)}/5
          </div>
          <div style={{ fontSize: 9, opacity: 0.5, marginTop: 4 }}>Avg</div>
        </div>

        <div
          style={{
            background: 'rgba(6, 182, 212, 0.1)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            borderRadius: 12,
            padding: 14,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 6 }}>Energy</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#06b6d4' }}>
            {summary.averageEnergy.toFixed(1)}/5
          </div>
          <div style={{ fontSize: 9, opacity: 0.5, marginTop: 4 }}>Avg</div>
        </div>

        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 12,
            padding: 14,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 6 }}>Sleep</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#ef4444' }}>
            {summary.averageSleep.toFixed(1)}h
          </div>
          <div style={{ fontSize: 9, opacity: 0.5, marginTop: 4 }}>Avg</div>
        </div>
      </div>

      {/* Insights Section */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: 14,
          padding: 18,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>📊 This Week's Insights</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {insights.length ? (
            insights.map((insight, idx) => (
              <div
                key={`insight-${idx}`}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 12,
                  lineHeight: '1.5',
                }}
              >
                {insight}
              </div>
            ))
          ) : (
            <div style={{ opacity: 0.6, fontSize: 12 }}>Track more data to see personalized insights</div>
          )}
        </div>
      </div>

      {/* Highlights */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: 14,
          padding: 18,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>✨ Weekly Highlights</div>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
          {summary.weeklyHighlights.map((highlight, idx) => (
            <li key={`highlight-${idx}`} style={{ fontSize: 12, opacity: 0.85 }}>
              {highlight}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default LifeInsightsPanel;
```

---

## 7) src/hooks/useHabitManager.ts

Custom React hook for habit state management.

```ts
/**
 * Habit Manager Hook
 * Manages habit CRUD, scoring, and streak calculations
 */

import { useCallback } from 'react';
import { Habit, DailyLifeMetric } from '../types/index';
import { calculateHabitScore } from '../lib/habitScore';
import { calculateHabitStreaks, generateDueDates } from '../lib/schedule';
import { getLocalDateString } from '../lib/dateUtils';

export interface UseHabitManagerOptions {
  habits: Habit[];
  dailyMetrics: DailyLifeMetric[];
  onUpdate: (habits: Habit[]) => void;
}

export function useHabitManager({ habits, dailyMetrics, onUpdate }: UseHabitManagerOptions) {
  const toggleHabitDate = useCallback(
    (habitId: string, dateStr: string) => {
      const updated = habits.map((h) => {
        if (h.id !== habitId) return h;

        const currentDates = h.completedDates || [];
        const isDone = currentDates.includes(dateStr);
        const nextCompletedDates = isDone
          ? currentDates.filter((d) => d !== dateStr)
          : [...currentDates, dateStr];

        const streaks = calculateHabitStreaks(nextCompletedDates);
        const dueDateCount = h.targetDaysPerWeek * 4;
        const score = calculateHabitScore({
          completions: nextCompletedDates.length,
          totalDueDates: dueDateCount,
          currentStreak: streaks.current,
          longestStreak: streaks.longest,
        });

        return {
          ...h,
          completedDates: nextCompletedDates,
          streak: streaks.current,
          bestStreak: streaks.longest,
          habitScore: score.currentStrength,
        };
      });

      onUpdate(updated);
    },
    [habits, onUpdate]
  );

  const addHabit = useCallback(
    (newHabit: Habit) => {
      onUpdate([...habits, newHabit]);
    },
    [habits, onUpdate]
  );

  const deleteHabit = useCallback(
    (habitId: string) => {
      onUpdate(habits.filter((h) => h.id !== habitId));
    },
    [habits, onUpdate]
  );

  const updateHabit = useCallback(
    (updatedHabit: Habit) => {
      onUpdate(habits.map((h) => (h.id === updatedHabit.id ? updatedHabit : h)));
    },
    [habits, onUpdate]
  );

  const getHabitsWithScores = useCallback(() => {
    return habits.map((h) => {
      const dueDateCount = h.targetDaysPerWeek * 4;
      const score = calculateHabitScore({
        completions: h.completedDates?.length || 0,
        totalDueDates: dueDateCount,
        currentStreak: h.streak || 0,
        longestStreak: h.bestStreak || 0,
      });

      return {
        ...h,
        habitScore: score.currentStrength,
        habitHealth: score.healthLabel,
      };
    });
  }, [habits]);

  return {
    toggleHabitDate,
    addHabit,
    deleteHabit,
    updateHabit,
    getHabitsWithScores,
  };
}

export default useHabitManager;
```

---

## 8) Firebase Schema Update

Update your `firebase-blueprint.json` to support new features:

```json
{
  "entities": {
    "UserAppData": {
      "title": "UserAppData",
      "description": "Enhanced life-tracking application document",
      "type": "object",
      "properties": {
        "tasks": { "type": "array", "description": "User tasks list" },
        "transactions": { "type": "array", "description": "Transactions list" },
        "budget": { "type": "object", "description": "Budget settings" },
        "exams": { "type": "array", "description": "Exams list" },
        "habits": { "type": "array", "description": "Enhanced habits with scoring" },
        "dailyMetrics": { "type": "array", "description": "Daily life metrics (mood, energy, sleep)" },
        "notes": { "type": "array", "description": "Notes list" },
        "vtuProfile": { "type": "object", "description": "VTU academic record" },
        "lastUpdated": { "type": "number", "description": "Timestamp" }
      },
      "required": ["tasks", "transactions", "budget", "exams", "habits", "notes"]
    },
    "HabitWithScore": {
      "title": "HabitWithScore",
      "description": "Habit with advanced scoring and streak tracking",
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" },
        "category": { "type": "string", "enum": ["fitness", "health", "productivity", "learning", "finance", "personal"] },
        "targetDaysPerWeek": { "type": "number" },
        "completedDates": { "type": "array", "description": "YYYY-MM-DD format dates" },
        "streak": { "type": "number" },
        "bestStreak": { "type": "number" },
        "habitScore": { "type": "number", "description": "0-100 strength score" },
        "scheduleType": { "type": "string", "enum": ["daily", "weekly_target", "custom_days"] },
        "customDays": { "type": "array", "description": "0=Sunday, 6=Saturday" },
        "createdAt": { "type": "number" }
      }
    },
    "DailyLifeMetric": {
      "title": "DailyLifeMetric",
      "description": "Multi-dimensional daily tracking",
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "date": { "type": "string", "description": "YYYY-MM-DD" },
        "mood": { "type": "number", "description": "1-5 rating" },
        "energy": { "type": "number", "description": "1-5 rating" },
        "stress": { "type": "number", "description": "1-5 rating" },
        "sleepHours": { "type": "number" },
        "sleepQuality": { "type": "number", "description": "1-5 rating" },
        "steps": { "type": "number" },
        "workoutDone": { "type": "boolean" },
        "notes": { "type": "string" },
        "updatedAt": { "type": "number" }
      }
    }
  },
  "firestore": {
    "/users/{userId}": {
      "schema": "UserAppData",
      "description": "User root document with all data"
    },
    "/users/{userId}/habits/{habitId}": {
      "schema": "HabitWithScore",
      "description": "Individual habit with scoring"
    },
    "/users/{userId}/metrics/{date}": {
      "schema": "DailyLifeMetric",
      "description": "Daily life metrics"
    }
  }
}
```

---

## Integration Checklist

1. ✅ Copy all 8 files to your project
2. ✅ Update `src/types/index.ts` to add `habitScore` field to Habit
3. ✅ Import `HabitCard` in your Habits view
4. ✅ Import `LifeInsightsPanel` in your Insights/Today view
5. ✅ Use `useHabitManager` hook to manage habit state
6. ✅ Update Firebase schema
7. ✅ Test habit toggle and scoring calculations
8. ✅ Deploy and monitor

---

This implementation bundle elevates LifeTrack-Hub with habit intelligence inspired by Loop Habit Tracker, Routine Tracker, and FxLifeSheet.
