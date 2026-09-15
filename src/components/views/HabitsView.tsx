import React, { useState } from 'react';
import {
  Flame,
  Plus,
  Trash2,
  CheckCircle2,
  Calendar,
  Award,
  TrendingUp,
} from 'lucide-react';
import { Habit } from '../../types/index.ts';

interface HabitsViewProps {
  habits: Habit[];
  onToggleHabitDate: (habitId: string, dateStr: string) => void;
  onAddHabit: (habit: Habit) => void;
  onDeleteHabit: (id: string) => void;
}

export const HabitsView: React.FC<HabitsViewProps> = ({
  habits,
  onToggleHabitDate,
  onAddHabit,
  onDeleteHabit,
}) => {
  const [newHabitName, setNewHabitName] = useState('');
  const [newCategory, setNewCategory] = useState('Study');

  // Generate the last 7 days (including today)
  const days: { dateStr: string; dayLabel: string; dayNumber: number; isToday: boolean }[] = [];
  const today = new Date();
  const todayIso = today.toISOString().split('T')[0];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
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
      id: `habit-${Date.now()}`,
      name: newHabitName.trim(),
      category: newCategory,
      targetDaysPerWeek: 7,
      completedDates: [todayIso],
      streak: 1,
      bestStreak: 1,
      createdAt: Date.now(),
    };

    onAddHabit(habit);
    setNewHabitName('');
  };

  return (
    <div id="habits-view-container" className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Daily Habits & Streaks</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Build consistency with recurring daily rituals. Click any day in the 7-day grid to log completion.
          </p>
        </div>

        {/* Quick Add Form */}
        <form onSubmit={handleCreateHabit} className="flex items-center gap-2">
          <input
            id="habit-new-name-input"
            type="text"
            placeholder="New habit (e.g. Read 20 pages)..."
            value={newHabitName}
            onChange={(e) => setNewHabitName(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 w-48 sm:w-60"
          />
          <button
            type="submit"
            id="habit-new-submit-btn"
            className="inline-flex items-center gap-1 px-3.5 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add</span>
          </button>
        </form>
      </div>

      {/* Habit List with 7-Day Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Header with Days */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Habit & Category</span>
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
          <div className="p-10 text-center text-slate-400">
            <Flame className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold">No habits added yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {habits.map((habit) => (
              <div
                key={habit.id}
                id={`habit-row-${habit.id}`}
                className="p-4 flex items-center justify-between hover:bg-slate-50/70 transition"
              >
                {/* Left: Habit Info & Streaks */}
                <div className="min-w-0 pr-4">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-xs sm:text-sm text-slate-900 truncate">{habit.name}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {habit.category || 'Daily'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                    <span className="flex items-center gap-1 text-orange-600 font-bold">
                      <Flame className="w-3.5 h-3.5 fill-orange-500" />
                      {habit.streak} day streak
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-slate-500">
                      <Award className="w-3 h-3 text-amber-500" />
                      Best: {habit.bestStreak}d
                    </span>
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
                    className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg ml-2"
                    title="Delete habit"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
