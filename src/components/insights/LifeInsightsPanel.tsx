/**
 * Life Insights Panel Component
 * Displays weekly life metrics summary and actionable insights
 * Based on FxLifeSheet pattern: correlations + recommendations
 */

import React from 'react';
import { DailyLifeMetric, Habit } from '../types/index';
import { buildWeeklySummary, generateInsights } from '../lib/analytics';

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
