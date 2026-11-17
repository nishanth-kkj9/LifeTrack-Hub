import React, { useEffect, useRef, useState } from 'react';
import {
  Flame,
  Plus,
  Trash2,
  CheckCircle2,
  Award,
  Activity,
  Download,
  LayoutGrid,
  Table,
} from 'lucide-react';
import { Habit, DailyLifeMetric } from '../../types/index.ts';
import { getLocalDateString, getLocalDateOffset, parseLocalDate } from '../../lib/dateUtils.ts';
import {
  HABIT_CATEGORIES,
  WEEKDAYS_MON_FIRST,
  analyzeHabitStrength,
  formatCustomDaysLabel,
  sortCustomDaysMonFirst,
} from '../../lib/habitScoring.ts';
import { HabitDetailModal } from '../todo/HabitDetailModal.tsx';
import { DailyLifeCheckinModal } from '../insights/DailyLifeCheckinModal.tsx';
import { exportHabitsCsv } from '../../lib/dataExport.ts';
import { HabitCard } from '../habits/HabitCard.tsx';
import { restoreTransaction } from '../../lib/entity.ts';

interface HabitsViewProps {
  habits: Habit[];
  onToggleHabitDate: (habitId: string, dateStr: string) => void;
  onAddHabit: (habit: Habit) => void;
  onDeleteHabit: (id: string) => void;
  onRestoreHabit?: (id: string) => void;
  onUpdateHabit?: (habit: Habit) => void;
  dailyMetrics?: DailyLifeMetric[];
  onSaveDailyMetric?: (metric: DailyLifeMetric) => void;
  handlesDeleteToast?: boolean;
}

export const HabitsView: React.FC<HabitsViewProps> = ({
  habits,
  onToggleHabitDate,
  onAddHabit,
  onDeleteHabit,
  onRestoreHabit,
  onUpdateHabit,
  dailyMetrics = [],
  onSaveDailyMetric,
  handlesDeleteToast = false,
}) => {
  const [newHabitName, setNewHabitName] = useState('');
  const [newCategory, setNewCategory] = useState<string>('Personal');
  const [newScheduleType, setNewScheduleType] = useState<'daily' | 'weekly_target' | 'custom_days'>('daily');
  const [newTargetDays, setNewTargetDays] = useState(3);
  const [newCustomDays, setNewCustomDays] = useState<number[]>([1, 3, 5]);
  const [selectedDetailHabit, setSelectedDetailHabit] = useState<Habit | null>(null);
  const [isCheckinOpen, setIsCheckinOpen] = useState(false);
  const [displayMode, setDisplayMode] = useState<'matrix' | 'cards'>('matrix');
  const [localDeletedHabit, setLocalDeletedHabit] = useState<Habit | null>(null);
  const localUndoTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (localUndoTimerRef.current) {
        clearTimeout(localUndoTimerRef.current);
        localUndoTimerRef.current = null;
      }
    };
  }, []);

  const triggerDeleteHabit = (habitId: string) => {
    const targetHabit = habits.find((h) => h.id === habitId) || null;
    onDeleteHabit(habitId);
    if (selectedDetailHabit?.id === habitId) {
      setSelectedDetailHabit(null);
    }
    if (!handlesDeleteToast && targetHabit) {
      if (localUndoTimerRef.current) {
        clearTimeout(localUndoTimerRef.current);
      }
      setLocalDeletedHabit(targetHabit);
      localUndoTimerRef.current = setTimeout(() => {
        setLocalDeletedHabit(null);
        localUndoTimerRef.current = null;
      }, 6000);
    }
  };

  // Generate the last 7 days (including today) in local time
  const days: {
    dateStr: string;
    dayLabel: string;
    shortWeekday: string;
    shortMonth: string;
    dayNumber: number;
    isToday: boolean;
  }[] = [];
  const todayIso = getLocalDateString();

  for (let i = 6; i >= 0; i--) {
    const dateStr = getLocalDateOffset(-i);
    const d = parseLocalDate(dateStr);
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'narrow' });
    const shortWeekday = d.toLocaleDateString('en-US', { weekday: 'short' });
    const shortMonth = d.toLocaleDateString('en-US', { month: 'short' });
    const dayNumber = d.getDate();
    days.push({
      dateStr,
      dayLabel,
      shortWeekday,
      shortMonth,
      dayNumber,
      isToday: dateStr === todayIso,
    });
  }

  const handleToggleNewCustomDay = (day: number) => {
    setNewCustomDays((prev) => {
      const next = prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day];
      return sortCustomDaysMonFirst(next);
    });
  };

  const handleCreateHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;
    if (newScheduleType === 'custom_days' && newCustomDays.length === 0) return;

    const orderedCustomDays = sortCustomDaysMonFirst(newCustomDays);
    const clampedTarget = Math.max(1, Math.min(7, newTargetDays));

    const habit: Habit = {
      id: `habit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: newHabitName.trim(),
      category: newCategory,
      targetDaysPerWeek:
        newScheduleType === 'weekly_target'
          ? clampedTarget
          : newScheduleType === 'custom_days'
            ? orderedCustomDays.length
            : 7,
      completedDates: [],
      streak: 0,
      bestStreak: 0,
      createdAt: Date.now(),
      scheduleType: newScheduleType,
      ...(newScheduleType === 'custom_days' ? { customDays: orderedCustomDays } : {}),
    };

    onAddHabit(habit);
    setNewHabitName('');
    setNewCategory('Personal');
    setNewScheduleType('daily');
    setNewTargetDays(3);
    setNewCustomDays([1, 3, 5]);
  };

  const todayMetric = dailyMetrics.find((m) => m.date === todayIso);

  return (
    <div id="habits-view-container" className="space-y-6 pb-12 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 bg-gradient-to-b from-white to-slate-50/50 p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Habits & Rituals</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              Consistency Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Build consistency with strength scoring, resilience tracking, and streak metrics.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {onSaveDailyMetric && (
            <button
              type="button"
              id="habits-open-checkin-btn"
              onClick={() => setIsCheckinOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition cursor-pointer min-h-[36px]"
            >
              <Activity className="w-3.5 h-3.5 text-purple-600" />
              <span>{todayMetric ? 'Update Daily Log' : 'Log Daily Metrics'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => exportHabitsCsv(habits)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition cursor-pointer shadow-2xs min-h-[36px]"
            title="Export habits history CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl bg-slate-100/80 p-0.5 border border-slate-200/70">
            <button
              type="button"
              id="habits-toggle-matrix-btn"
              onClick={() => setDisplayMode('matrix')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer select-none ${
                displayMode === 'matrix' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>7-Day Grid</span>
            </button>
            <button
              type="button"
              id="habits-toggle-cards-btn"
              onClick={() => setDisplayMode('cards')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer select-none ${
                displayMode === 'cards' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
          </div>

          {/* Quick Add Form */}
          <form onSubmit={handleCreateHabit} className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
            <input
              id="habit-new-name-input"
              type="text"
              placeholder="New habit (e.g. Read 20 pages)..."
              value={newHabitName}
              onChange={(e) => setNewHabitName(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white flex-1 min-w-[140px] sm:flex-none sm:w-48 min-h-[36px] font-medium text-slate-800"
            />
            <select
              id="habit-new-category-select"
              aria-label="Category"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white min-h-[36px] font-semibold text-slate-700 cursor-pointer"
            >
              {HABIT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <select
              id="habit-new-schedule-select"
              aria-label="Schedule"
              value={newScheduleType}
              onChange={(e) =>
                setNewScheduleType(e.target.value as 'daily' | 'weekly_target' | 'custom_days')
              }
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white min-h-[36px] font-semibold text-slate-700 cursor-pointer"
            >
              <option value="daily">Every day</option>
              <option value="weekly_target">x per week</option>
              <option value="custom_days">Custom days</option>
            </select>
            {newScheduleType === 'weekly_target' && (
              <div className="inline-flex items-center gap-1 px-1.5 py-1 bg-slate-50 border border-slate-200 rounded-xl min-h-[36px]">
                <button
                  type="button"
                  aria-label="Decrease new habit weekly target"
                  disabled={newTargetDays <= 1}
                  onClick={() => setNewTargetDays((v) => Math.max(1, v - 1))}
                  className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  -
                </button>
                <span className="px-1.5 text-xs font-bold text-slate-800 tabular-nums">
                  {newTargetDays}x/wk
                </span>
                <button
                  type="button"
                  aria-label="Increase new habit weekly target"
                  disabled={newTargetDays >= 7}
                  onClick={() => setNewTargetDays((v) => Math.min(7, v + 1))}
                  className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  +
                </button>
              </div>
            )}
            {newScheduleType === 'custom_days' && (
              <div className="inline-flex items-center gap-1 flex-wrap bg-slate-50 border border-slate-200 rounded-xl px-1.5 py-1 min-h-[36px]">
                {WEEKDAYS_MON_FIRST.map(({ day, label }) => {
                  const selected = newCustomDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => handleToggleNewCustomDay(day)}
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border transition cursor-pointer ${
                        selected
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            <button
              type="submit"
              id="habit-new-submit-btn"
              disabled={newScheduleType === 'custom_days' && newCustomDays.length === 0}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition cursor-pointer shadow-xs min-h-[36px] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </form>
        </div>
      </div>

      {/* Habit Views: Cards or 7-Day Grid */}
      {displayMode === 'cards' ? (
        habits.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3 shadow-xs">
            <Flame className="w-10 h-10 text-slate-300 mx-auto" />
            <div>
              <p className="text-sm font-bold text-slate-800">No habits added yet</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Enter a daily ritual above (e.g. Read 20 pages or Solve 3 problems) to start your habit score.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="habits-cards-grid">
            {habits.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                onToggle={onToggleHabitDate}
                onDelete={triggerDeleteHabit}
                onUpdate={onUpdateHabit}
                onOpenDetail={setSelectedDetailHabit}
              />
            ))}
          </div>
        )
      ) : (
        /* Habit List with 7-Day Grid */
        <div
          id="habits-seven-day-card"
          className="-mx-3 sm:mx-0 bg-white rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-x-clip sm:overflow-hidden"
        >
          {/* Mobile (< 640px) Sticky 3-Letter Weekday Header aligned to grid-cols-7 */}
          <div
            data-testid="habits-mobile-weekday-header"
            className="sm:hidden sticky top-[125px] z-10 bg-slate-50/95 backdrop-blur-xs border-b border-slate-100 px-1.5 py-2 rounded-t-2xl"
          >
            <div className="grid grid-cols-7 gap-1">
              {days.map((d) => (
                <div
                  key={d.dateStr}
                  className={`text-center py-1 rounded-xl transition-colors ${
                    d.isToday ? 'bg-orange-100/80 text-orange-950 font-black ring-1 ring-orange-200' : 'text-slate-500'
                  }`}
                >
                  <span className="text-[11px] block font-bold">{d.shortWeekday}</span>
                  <span className="text-[11px] font-bold tabular-nums">{d.dayNumber}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Desktop (>= 640px) Table Header with Days */}
          <div className="hidden sm:flex p-4 bg-slate-50/50 border-b border-slate-100 items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Habit & Strength Rating</span>
            <div className="flex items-center gap-2 sm:gap-3 mr-12 sm:mr-16">
              {days.map((d) => (
                <div
                  key={d.dateStr}
                  className={`w-7 sm:w-9 text-center py-1 rounded-xl transition-colors ${
                    d.isToday ? 'bg-orange-100/80 text-orange-950 font-black ring-1 ring-orange-200' : 'text-slate-500'
                  }`}
                >
                  <span className="text-[10px] block uppercase font-bold">{d.dayLabel}</span>
                  <span className="text-xs font-bold tabular-nums">{d.dayNumber}</span>
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

                return (
                  <div
                    key={habit.id}
                    id={`habit-row-${habit.id}`}
                    className="px-1.5 py-3 sm:p-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-0 hover:bg-slate-50/70 transition"
                  >
                    {/* Line 1 & Line 2: Habit Info, Streaks & Loop Strength */}
                    <div className="min-w-0 px-1 sm:px-0 sm:pr-4">
                      {/* Line 1: name + category + badges (wrap) */}
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setSelectedDetailHabit(habit)}
                          className="font-bold text-xs sm:text-sm text-slate-900 hover:text-indigo-600 transition truncate max-w-full text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 rounded"
                        >
                          {habit.name}
                        </button>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {habit.scheduleType === 'weekly_target'
                            ? `${habit.targetDaysPerWeek || 7}x / Week`
                            : habit.scheduleType === 'custom_days' &&
                                Array.isArray(habit.customDays) &&
                                habit.customDays.length > 0
                              ? formatCustomDaysLabel(habit.customDays)
                              : habit.category || 'Daily'}
                        </span>
                        {/* Strength Badge */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${analysis.levelBadgeColor}`}>
                          {analysis.strengthScore}% {analysis.levelLabel}
                        </span>
                        {/* Routine Health Status */}
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                          {analysis.healthLabel}
                        </span>
                        {/* Adaptive Backlog Badge */}
                        {analysis.backlogDays > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            {habit.scheduleType === 'weekly_target'
                              ? `${analysis.backlogDays} left this week`
                              : `${analysis.backlogDays}d Backlog`}
                          </span>
                        )}
                      </div>

                      {/* Line 2: streak / best / configure */}
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                        <span className="flex items-center gap-1 text-orange-600 font-bold">
                          <Flame className="w-3.5 h-3.5 fill-orange-500" />
                          {analysis.currentStreak}{habit.scheduleType === 'weekly_target' ? 'w' : 'd'} streak
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <Award className="w-3 h-3 text-amber-500" />
                          Best: {analysis.bestStreak}{habit.scheduleType === 'weekly_target' ? 'w' : 'd'}
                        </span>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => setSelectedDetailHabit(habit)}
                          className="text-[11px] text-indigo-600 font-semibold hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded"
                        >
                          Configure / Vacation
                        </button>
                      </div>
                    </div>

                    {/* Line 3 (mobile) / Right column (desktop): 7-Day interactive check-in buttons + desktop delete */}
                    <div className="flex items-center w-full sm:w-auto sm:gap-3 sm:shrink-0">
                      <div className="grid grid-cols-7 gap-1 w-full sm:w-auto sm:flex sm:items-center sm:gap-3">
                        {days.map((d) => {
                          const isDone = habit.completedDates.includes(d.dateStr);
                          const dateLabel = `${d.shortWeekday} ${d.dayNumber} ${d.shortMonth}`;
                          return (
                            <button
                              key={d.dateStr}
                              type="button"
                              id={`habit-check-${habit.id}-${d.dateStr}`}
                              aria-label={`${habit.name}, ${dateLabel}, ${isDone ? 'done' : 'not done'}`}
                              aria-pressed={isDone}
                              onClick={() => onToggleHabitDate(habit.id, d.dateStr)}
                              className={`w-full min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1 ${
                                isDone
                                  ? 'bg-orange-500 text-white shadow-xs'
                                  : d.isToday
                                  ? 'bg-orange-50 border border-orange-200 text-orange-300 hover:bg-orange-100'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-300'
                              }`}
                              title={`${habit.name} on ${d.dateStr}`}
                            >
                              {isDone ? (
                                <CheckCircle2 className="w-5 h-5 text-white" />
                              ) : (
                                <span className="w-2.5 h-2.5 sm:w-2 sm:h-2 rounded-full bg-slate-300" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        id={`habit-delete-${habit.id}`}
                        aria-label={`Delete habit ${habit.name}`}
                        onClick={() => triggerDeleteHabit(habit.id)}
                        className="hidden sm:inline-flex p-1.5 text-slate-400 hover:text-rose-500 rounded-lg ml-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
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
      )}

      {/* Habit Detail & Vacation Modal */}
      {selectedDetailHabit && (
        <HabitDetailModal
          isOpen={!!selectedDetailHabit}
          onClose={() => setSelectedDetailHabit(null)}
          habit={habits.find((h) => h.id === selectedDetailHabit.id) || selectedDetailHabit}
          onUpdateHabit={(updated) => {
            if (onUpdateHabit) onUpdateHabit(updated);
            setSelectedDetailHabit(updated);
          }}
          onDeleteHabit={triggerDeleteHabit}
          onToggleHabitDate={onToggleHabitDate}
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

      {!handlesDeleteToast && localDeletedHabit && (
        <div
          id="habit-undo-toast-banner"
          data-testid="habit-undo-toast"
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-[60] bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-lg border border-slate-700 text-xs font-bold flex items-center gap-3"
        >
          <span>Habit deleted - </span>
          <button
            type="button"
            id="habit-undo-toast-btn"
            onClick={() => {
              const target = localDeletedHabit;
              if (localUndoTimerRef.current) {
                clearTimeout(localUndoTimerRef.current);
                localUndoTimerRef.current = null;
              }
              setLocalDeletedHabit(null);
              if (onRestoreHabit) {
                onRestoreHabit(target.id);
              } else {
                const restored = restoreTransaction(target);
                if (onUpdateHabit) {
                  onUpdateHabit(restored);
                } else {
                  onAddHabit(restored);
                }
              }
            }}
            className="text-emerald-400 hover:text-emerald-300 underline cursor-pointer font-extrabold"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => {
              if (localUndoTimerRef.current) {
                clearTimeout(localUndoTimerRef.current);
                localUndoTimerRef.current = null;
              }
              setLocalDeletedHabit(null);
            }}
            className="text-slate-400 hover:text-white cursor-pointer"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
