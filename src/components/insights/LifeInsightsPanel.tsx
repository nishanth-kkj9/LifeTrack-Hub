/**
 * Life Insights Panel Component
 * Displays weekly life metrics summary and actionable insights
 * Based on FxLifeSheet pattern: correlations + recommendations
 */

import React from 'react';
import { DailyLifeMetric, Habit } from '../../types/index.ts';
import { buildWeeklySummary, generateInsights } from '../../lib/analytics.ts';

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
    <div className={`space-y-4 ${className}`}>
      {/* Weekly Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 text-center">
          <div className="text-[11px] font-medium text-slate-400">Habits</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-purple-400 mt-1">
            {summary.totalHabits}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Active</div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 text-center">
          <div className="text-[11px] font-medium text-slate-400">Completion</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400 mt-1">
            {summary.completionRate.toFixed(0)}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Weekly</div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 text-center">
          <div className="text-[11px] font-medium text-slate-400">Mood</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-400 mt-1">
            {summary.averageMood.toFixed(1)}/5
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Avg</div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 text-center">
          <div className="text-[11px] font-medium text-slate-400">Energy</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-cyan-400 mt-1">
            {summary.averageEnergy.toFixed(1)}/5
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Avg</div>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 text-center">
          <div className="text-[11px] font-medium text-slate-400">Sleep</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-rose-400 mt-1">
            {summary.averageSleep.toFixed(1)}h
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Avg</div>
        </div>
      </div>

      {/* Insights Section */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3">
          Weekly Correlations & Recommendations
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
              Track more daily habits and logs to generate personalized correlations.
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
