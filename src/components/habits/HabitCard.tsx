/**
 * Advanced Habit Card Component
 * Displays habit with score, streak, and adaptive status
 */

import React from 'react';
import { Habit } from '../../types/index.ts';
import { calculateHabitScore } from '../../lib/habitScore.ts';
import { getLocalDateString } from '../../lib/dateUtils.ts';

export interface HabitCardProps {
  key?: React.Key;
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

export const HabitCard: React.FC<HabitCardProps> = ({
  habit,
  onToggle,
  onDelete,
  onUpdate,
}) => {
  const today = getLocalDateString();
  const isCompletedToday = habit.completedDates?.includes(today);

  const dueDateCount = (habit.targetDaysPerWeek || 7) * 4;
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
        transition: 'all 0.2s',
      }}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md"
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }} className="text-slate-900 dark:text-slate-100">
            {habit.name}
          </div>
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }} className="text-slate-500">
            {habit.targetDaysPerWeek || 7}x per week • {habit.category || 'general'}
          </div>
        </div>
        <div style={{ fontSize: 22 }} title={habitScore.healthLabel}>
          {getHealthIndicator()}
        </div>
      </div>

      {/* Score Bars */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg">
          <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 2 }} className="text-slate-500 uppercase tracking-wider font-semibold">
            Strength
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: accentColor }}>
            {habitScore.currentStrength.toFixed(0)}/100
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg">
          <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 2 }} className="text-slate-500 uppercase tracking-wider font-semibold">
            Streak
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>
            {habit.streak || 0}d
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg">
          <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 2 }} className="text-slate-500 uppercase tracking-wider font-semibold">
            Completion
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>
            {habitScore.completionRate.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onToggle(habit.id, today)}
          style={{
            flex: 1,
            padding: '10px',
            background: isCompletedToday ? accentColor : 'rgba(124, 58, 237, 0.08)',
            color: isCompletedToday ? '#fff' : accentColor,
            border: isCompletedToday ? 'none' : `1px solid ${accentColor}40`,
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          className="hover:opacity-90 active:scale-[0.99]"
        >
          {isCompletedToday ? '✓ Completed Today' : 'Mark Complete'}
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(habit.id)}
            className="px-2.5 py-2 text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
            title="Delete habit"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

export default HabitCard;
