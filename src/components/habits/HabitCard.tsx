/**
 * Advanced Habit Card Component
 * Displays habit with score, streak, and adaptive status
 */

import React, { useState } from 'react';
import { Habit } from '../../types/index.ts';
import {
  formatCustomDaysLabel,
  getHabitCategoryColor,
  getHabitStats,
} from '../../lib/habitScoring.ts';
import { getLocalDateOffset, getLocalDateString, parseLocalDate } from '../../lib/dateUtils.ts';
import { HabitDetailModal } from '../todo/HabitDetailModal.tsx';

export interface HabitCardProps {
  key?: React.Key;
  habit: Habit;
  onToggle: (habitId: string, date: string) => void;
  onDelete?: (habitId: string) => void;
  onUpdate?: (habit: Habit) => void;
  onOpenDetail?: (habit: Habit) => void;
  todayStr?: string;
}

export const HabitCard: React.FC<HabitCardProps> = ({
  habit,
  onToggle,
  onDelete,
  onUpdate,
  onOpenDetail,
  todayStr,
}) => {
  const [isLocalDetailOpen, setIsLocalDetailOpen] = useState(false);

  const today = todayStr || getLocalDateString();
  const todayDate = parseLocalDate(today);
  const completedDates = Array.isArray(habit.completedDates) ? habit.completedDates : [];
  const isCompletedToday = completedDates.includes(today);
  const stats = getHabitStats(habit, today);

  const isRestDay =
    stats.isOnVacationToday ||
    (habit.scheduleType !== 'weekly_target' && !stats.isDueToday);
  const isMarkDisabled = isRestDay && !isCompletedToday;

  const accentColor = getHabitCategoryColor(habit.category);

  const weekDays = Array.from({ length: 7 }, (_, idx) => {
    const dateStr = getLocalDateOffset(idx - 6, todayDate);
    const d = parseLocalDate(dateStr);
    return {
      dateStr,
      dayInitial: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
      shortWeekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
      shortMonth: d.toLocaleDateString('en-US', { month: 'short' }),
      dayNumber: d.getDate(),
      isToday: dateStr === today,
    };
  });

  const getHealthIndicator = () => {
    if (stats.healthLabel === 'Excellent') return '🟢';
    if (stats.healthLabel === 'Strong') return '🟡';
    if (stats.healthLabel === 'Stable' || stats.healthLabel === 'Building') return '🟠';
    return '🔴';
  };

  return (
    <div
      style={{
        borderLeft: `4px solid ${accentColor}`,
      }}
      className="bg-white rounded-2xl border border-slate-200 p-4 mb-3 transition shadow-xs hover:shadow-sm"
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="min-w-0 pr-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => (onOpenDetail ? onOpenDetail(habit) : setIsLocalDetailOpen(true))}
              className="text-left text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 rounded"
            >
              {habit.name}
            </button>
            {isRestDay && (
              <span
                data-testid={`habit-card-rest-badge-${habit.id}`}
                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200"
              >
                Rest day
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }} className="text-slate-500">
            {habit.scheduleType === 'custom_days' && Array.isArray(habit.customDays) && habit.customDays.length > 0
              ? formatCustomDaysLabel(habit.customDays)
              : habit.scheduleType === 'weekly_target' && (habit.targetDaysPerWeek || 7) < 7
                ? `${habit.targetDaysPerWeek}x per week`
                : 'Daily'}{' '}
            • {habit.category || 'Personal'}
            {habit.reminderTime ? ` • 🔔 ${habit.reminderTime}` : ''}
          </div>
        </div>
        <div style={{ fontSize: 22 }} title={stats.healthLabel}>
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
            {stats.strengthScore}/100
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg">
          <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 2 }} className="text-slate-500 uppercase tracking-wider font-semibold">
            Streak
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>
            {stats.currentStreak}{habit.scheduleType === 'weekly_target' ? 'w' : 'd'}
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg">
          <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 2 }} className="text-slate-500 uppercase tracking-wider font-semibold">
            Completion
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>
            {stats.completionRate}%
          </div>
        </div>
      </div>

      {/* Last 7 Days Quick Strip */}
      <div className="mb-3" data-testid={`habit-card-week-strip-${habit.id}`}>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((d) => {
            const isDone = completedDates.includes(d.dateStr);
            const dateLabel = `${d.shortWeekday} ${d.dayNumber} ${d.shortMonth}`;
            return (
              <button
                key={d.dateStr}
                type="button"
                aria-label={`${habit.name}, ${dateLabel}, ${isDone ? 'done' : 'not done'}`}
                aria-pressed={isDone}
                onClick={() => onToggle(habit.id, d.dateStr)}
                title={`${habit.name} on ${d.dateStr}`}
                className={`flex flex-col items-center justify-center py-1 rounded-lg border text-[10px] font-bold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                  isDone
                    ? 'text-white border-transparent shadow-2xs'
                    : d.isToday
                      ? 'bg-orange-50/90 border-orange-200 text-orange-800 hover:bg-orange-100'
                      : 'bg-slate-50 border-slate-200/80 text-slate-500 hover:bg-slate-100'
                }`}
                style={isDone ? { backgroundColor: accentColor } : undefined}
              >
                <span className="leading-none opacity-85">{d.dayInitial}</span>
                <span className="text-[9px] tabular-nums leading-tight mt-0.5">{d.dayNumber}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Button */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isMarkDisabled}
          onClick={() => onToggle(habit.id, today)}
          style={
            isMarkDisabled
              ? {
                  flex: 1,
                  padding: '10px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                }
              : {
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
                }
          }
          className={
            isMarkDisabled
              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              : 'hover:opacity-90 active:scale-[0.99]'
          }
        >
          {isCompletedToday ? '✓ Completed Today' : 'Mark Complete'}
        </button>
        {onDelete && (
          <button
            type="button"
            id={`habit-card-delete-${habit.id}`}
            aria-label={`Delete habit ${habit.name}`}
            onClick={() => onDelete(habit.id)}
            className="px-2.5 py-2 text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
            title="Delete habit"
          >
            ✕
          </button>
        )}
      </div>

      {isMarkDisabled && (
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
          <span>{stats.isOnVacationToday ? 'Vacation / Rest day' : 'Not scheduled today'}</span>
          <button
            type="button"
            data-testid={`habit-card-override-${habit.id}`}
            onClick={() => onToggle(habit.id, today)}
            className="font-semibold text-indigo-600 hover:text-indigo-800 underline underline-offset-2 cursor-pointer"
          >
            Complete anyway
          </button>
        </div>
      )}

      {!onOpenDetail && isLocalDetailOpen && (
        <HabitDetailModal
          isOpen={isLocalDetailOpen}
          onClose={() => setIsLocalDetailOpen(false)}
          habit={habit}
          onUpdateHabit={(updated) => onUpdate?.(updated)}
          onDeleteHabit={(id) => onDelete?.(id)}
          onToggleHabitDate={onToggle}
          todayStr={today}
        />
      )}
    </div>
  );
};

export default HabitCard;

