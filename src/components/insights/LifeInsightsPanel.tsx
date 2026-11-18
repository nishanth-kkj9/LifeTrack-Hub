/**
 * Life Insights Panel Component
 * Displays weekly life metrics summary and actionable insights
 * Based on FxLifeSheet pattern: correlations + recommendations
 */

import React, { useMemo } from 'react';
import { DailyLifeMetric, Habit } from '../../types/index.ts';
import { buildWeeklySummary, generateInsights } from '../../lib/analytics.ts';
import { getHabitStats } from '../../lib/habitScoring.ts';

export interface LifeInsightsPanelProps {
  habits: Habit[];
  dailyMetrics: DailyLifeMetric[];
  rangeDays?: 7 | 30 | null;
  className?: string;
}

export function LifeInsightsPanel({
  habits,
  dailyMetrics,
  rangeDays = 7,
  className = '',
}: LifeInsightsPanelProps) {
  const habitItems = useMemo(
    () =>
      habits.map((h) => {
        const stats = getHabitStats(h);
        return {
          id: h.id,
          name: h.name,
          score: {
            currentStrength: stats.strengthScore,
            completionRate: stats.completionRate,
          },
        };
      }),
    [habits]
  );

  const metricsItems = useMemo(
    () =>
      dailyMetrics.map((m) => ({
        date: m.date,
        mood: m.moodLevel,
        energy: m.energyLevel,
        stress: m.stressLevel,
        sleepHours: m.sleepHours,
        steps: m.stepsCount,
        workoutDone: m.workoutDone,
        deletedAt: m.deletedAt,
      })),
    [dailyMetrics]
  );

  const summary = useMemo(
    () => buildWeeklySummary(habitItems, metricsItems, rangeDays),
    [habitItems, metricsItems, rangeDays]
  );
  const insights = useMemo(
    () => generateInsights(habitItems, metricsItems, rangeDays),
    [habitItems, metricsItems, rangeDays]
  );
  const rangeAvgLabel =
    rangeDays === null ? 'All-time avg' : rangeDays === 30 ? '30-day avg' : '7-day avg';

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Period Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 text-center">
          <div className="text-[11px] font-medium text-slate-400">Habits</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-purple-400 mt-1">
            {summary.totalHabits}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Active</div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 text-center">
          <div className="text-[11px] font-medium text-slate-400">Done this period</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400 mt-1">
            {summary.completionRate.toFixed(0)}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">{rangeAvgLabel}</div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 text-center">
          <div className="text-[11px] font-medium text-slate-400">Habit strength</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-teal-400 mt-1">
            {summary.averageStrength.toFixed(0)}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Consistency</div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 text-center">
          <div className="text-[11px] font-medium text-slate-400">Mood</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-400 mt-1">
            {summary.moodCount > 0 && Number.isFinite(summary.averageMood) ? `${summary.averageMood.toFixed(1)}/5` : '—'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">{rangeAvgLabel}</div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 text-center">
          <div className="text-[11px] font-medium text-slate-400">Energy</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-cyan-400 mt-1">
            {summary.energyCount > 0 && Number.isFinite(summary.averageEnergy) ? `${summary.averageEnergy.toFixed(1)}/5` : '—'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">{rangeAvgLabel}</div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 text-center">
          <div className="text-[11px] font-medium text-slate-400">Sleep</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-rose-400 mt-1">
            {summary.sleepCount > 0 && Number.isFinite(summary.averageSleep) ? `${summary.averageSleep.toFixed(1)}h` : '—'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">{rangeAvgLabel}</div>
        </div>
      </div>

      {/* Insights Section */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3">
          Insights
        </h3>
        <div className="space-y-2">
          {insights.length ? (
            insights.map((insight, idx) => (
              <div
                key={`insight-${idx}`}
                className="bg-slate-900/60 border border-slate-700/60 rounded-lg p-3 text-xs text-slate-300 leading-relaxed"
              >
                {insight}
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400 py-1">
              Track more daily habits and logs to generate personalized insights.
            </p>
          )}
        </div>
      </div>

      {/* Highlights */}
      {summary.weeklyHighlights && summary.weeklyHighlights.length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2.5">
            Key Highlights
          </h3>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {summary.weeklyHighlights.map((highlight, idx) => (
              <li key={`highlight-${idx}`} className="flex items-start gap-2">
                <span className="text-purple-400 shrink-0 font-bold">·</span>
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default LifeInsightsPanel;
