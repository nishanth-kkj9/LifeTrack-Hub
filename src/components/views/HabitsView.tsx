import React, { useState } from 'react';
import {
  Flame,
  Plus,
  Trash2,
  CheckCircle2,
  Calendar,
  Award,
  TrendingUp,
  Activity,
  Download,
} from 'lucide-react';
import { Habit, DailyLifeMetric } from '../../types/index.ts';
import { getLocalDateString, getLocalDateOffset, parseLocalDate } from '../../lib/dateUtils.ts';
import { analyzeHabitStrength } from '../../lib/habitScoring.ts';
import { calculateHabitScore } from '../../lib/habitScore.ts';
import { computeAdaptiveSchedule } from '../../lib/schedule.ts';
import { HabitDetailModal } from '../todo/HabitDetailModal.tsx';
import { DailyLifeCheckinModal } from '../insights/DailyLifeCheckinModal.tsx';
import { exportHabitsCsv } from '../../lib/dataExport.ts';

interface HabitsViewProps {
  habits: Habit[];
  onToggleHabitDate: (habitId: string, dateStr: string) => void;
  onAddHabit: (habit: Habit) => void;
  onDeleteHabit: (id: string) => void;
  onUpdateHabit?: (habit: Habit) => void;
  dailyMetrics?: DailyLifeMetric[];
  onSaveDailyMetric?: (metric: DailyLifeMetric) => void;
}

export const HabitsView: React.FC<HabitsViewProps> = ({
  habits,
  onToggleHabitDate,
  onAddHabit,
  onDeleteHabit,
  onUpdateHabit,
  dailyMetrics = [],
  onSaveDailyMetric,
}) => {
  const [newHabitName, setNewHabitName] = useState('');
  const [newCategory, setNewCategory] = useState('Study');
  const [selectedDetailHabit, setSelectedDetailHabit] = useState<Habit | null>(null);
  const [isCheckinOpen, setIsCheckinOpen] = useState(false);

  // Generate the last 7 days (including today) in local time
  const days: { dateStr: string; dayLabel: string; dayNumber: number; isToday: boolean }[] = [];
  const todayIso = getLocalDateString();

  for (let i = 6; i >= 0; i--) {
    const dateStr = getLocalDateOffset(-i);
    const d = parseLocalDate(dateStr);
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'narrow' });
    const dayNumber = d.getDate();
    days.push({
      dateStr,
      dayLabel,
      dayNumber,
      isToday: dateStr === todayIso,
    });
  }

  const handleCreateHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;

    const habit: Habit = {
      id: `habit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: newHabitName.trim(),
      category: newCategory,
      targetDaysPerWeek: 7,
      completedDates: [],
      streak: 0,
      bestStreak: 0,
      createdAt: Date.now(),
      scheduleType: 'daily',
    };

    onAddHabit(habit);
    setNewHabitName('');
  };

  const todayMetric = dailyMetrics.find((m) => m.date === todayIso);

  return (
    <div id="habits-view-container" className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Habits & Ritual Intelligence</h1>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              Loop Scoring Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Build consistency with exponential strength scoring, resilience tracking & vacation modes.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {onSaveDailyMetric && (
            <button
              type="button"
              id="habits-open-checkin-btn"
              onClick={() => setIsCheckinOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition cursor-pointer min-h-[38px]"
            >
              <Activity className="w-4 h-4 text-purple-600" />
              <span>{todayMetric ? 'Update Daily Log' : 'Log Daily Life Metrics'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => exportHabitsCsv(habits)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer min-h-[38px]"
            title="Export habits history CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          {/* Quick Add Form */}
          <form onSubmit={handleCreateHabit} className="flex items-center gap-1.5">
            <input
              id="habit-new-name-input"
              type="text"
              placeholder="New habit (e.g. Read 20 pages)..."
              value={newHabitName}
              onChange={(e) => setNewHabitName(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 w-40 sm:w-52 min-h-[38px]"
            />
            <button
              type="submit"
              id="habit-new-submit-btn"
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition cursor-pointer shadow-xs min-h-[38px]"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </form>
        </div>
      </div>

      {/* Habit List with 7-Day Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Header with Days */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Habit & Strength Rating</span>
          <div className="flex items-center gap-2 sm:gap-3 mr-12 sm:mr-16">
            {days.map((d) => (
              <div
                key={d.dateStr}
                className={`w-7 sm:w-9 text-center py-1 rounded-lg ${
                  d.isToday ? 'bg-orange-50 text-orange-900 font-extrabold' : 'text-slate-500'
                }`}
              >
                <span className="text-[10px] block uppercase">{d.dayLabel}</span>
                <span className="text-xs font-bold">{d.dayNumber}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Habit Rows */}
        {habits.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Flame className="w-10 h-10 text-slate-300 mx-auto" />
            <div>
              <p className="text-sm font-bold text-slate-800">No habits added yet</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Enter a daily ritual above (e.g. Read 20 pages or Solve 3 problems) to start your habit score.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {habits.map((habit) => {
              const analysis = analyzeHabitStrength(habit, todayIso);
              const totalDays = Math.max(1, Math.round((Date.now() - habit.createdAt) / (1000 * 60 * 60 * 24)) + 1);
              const habitScore = calculateHabitScore({
                completions: habit.completedDates?.length || 0,
                totalDueDates: totalDays,
                currentStreak: analysis.currentStreak,
                longestStreak: analysis.bestStreak,
              });
              const scheduleStatus = computeAdaptiveSchedule({
                completedDates: habit.completedDates || [],
                dueDates: [todayIso],
                skippedDates: (habit.vacationPeriods || []).flatMap((v) => [v.startDate, v.endDate]),
                targetDate: todayIso,
              });

              return (
                <div
                  key={habit.id}
                  id={`habit-row-${habit.id}`}
                  className="p-4 flex items-center justify-between hover:bg-slate-50/70 transition"
                >
                  {/* Left: Habit Info, Streaks & Loop Strength */}
                  <div className="min-w-0 pr-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setSelectedDetailHabit(habit)}
                        className="font-bold text-xs sm:text-sm text-slate-900 hover:text-indigo-600 transition truncate text-left cursor-pointer"
                      >
                        {habit.name}
                      </button>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {habit.category || 'Daily'}
                      </span>
                      {/* Strength Badge */}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${analysis.levelBadgeColor}`}>
                        {analysis.strengthScore}% {analysis.levelLabel}
                      </span>
                      {/* Routine Health Status from habitScore.ts */}
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                        {habitScore.healthLabel}
                      </span>
                      {/* Adaptive Backlog Badge */}
                      {habitScore.backlogDays > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          {habitScore.backlogDays}d Backlog
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-orange-600 font-bold">
                        <Flame className="w-3.5 h-3.5 fill-orange-500" />
                        {analysis.currentStreak}d streak
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-slate-500">
                        <Award className="w-3 h-3 text-amber-500" />
                        Best: {analysis.bestStreak}d
                      </span>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => setSelectedDetailHabit(habit)}
                        className="text-[11px] text-indigo-600 font-semibold hover:underline cursor-pointer"
                      >
                        Configure / Vacation
                      </button>
                    </div>
                  </div>

                  {/* Right: 7-Day interactive check-in buttons + delete */}
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    {days.map((d) => {
                      const isDone = habit.completedDates.includes(d.dateStr);
                      return (
                        <button
                          key={d.dateStr}
                          id={`habit-check-${habit.id}-${d.dateStr}`}
                          onClick={() => onToggleHabitDate(habit.id, d.dateStr)}
                          className={`w-7 h-7 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition cursor-pointer select-none ${
                            isDone
                              ? 'bg-orange-500 text-white shadow-xs'
                              : d.isToday
                              ? 'bg-orange-50 border border-orange-200 text-orange-300 hover:bg-orange-100'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-300'
                          }`}
                          title={`${habit.name} on ${d.dateStr}`}
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-slate-300" />
                          )}
                        </button>
                      );
                    })}

                    <button
                      id={`habit-delete-${habit.id}`}
                      onClick={() => onDeleteHabit(habit.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg ml-2 cursor-pointer"
                      title="Delete habit"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Habit Detail & Vacation Modal */}
      {selectedDetailHabit && (
        <HabitDetailModal
          isOpen={!!selectedDetailHabit}
          onClose={() => setSelectedDetailHabit(null)}
          habit={selectedDetailHabit}
          onUpdateHabit={(updated) => {
            if (onUpdateHabit) onUpdateHabit(updated);
            setSelectedDetailHabit(updated);
          }}
          onDeleteHabit={onDeleteHabit}
        />
      )}

      {/* Daily Metrics Checkin Modal */}
      {onSaveDailyMetric && (
        <DailyLifeCheckinModal
          isOpen={isCheckinOpen}
          onClose={() => setIsCheckinOpen(false)}
          existingMetric={todayMetric}
          onSaveMetric={onSaveDailyMetric}
        />
      )}
    </div>
  );
};
