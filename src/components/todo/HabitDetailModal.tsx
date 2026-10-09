import React, { useState } from 'react';
import {
  X,
  Flame,
  Award,
  Calendar,
  Download,
  Plus,
  Trash2,
  Pause,
  ShieldCheck,
  TrendingUp,
  Settings2,
} from 'lucide-react';
import { Habit, VacationPeriod } from '../../types/index.ts';
import { analyzeHabitStrength } from '../../lib/habitScoring.ts';
import { calculateHabitScore } from '../../lib/habitScore.ts';
import { computeAdaptiveSchedule } from '../../lib/schedule.ts';
import { exportHabitsCsv } from '../../lib/dataExport.ts';
import { getLocalDateString } from '../../lib/dateUtils.ts';
import { useModalFocus } from '../../hooks/useModalFocus.ts';

interface HabitDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  habit: Habit | null;
  onUpdateHabit: (habit: Habit) => void;
  onDeleteHabit: (habitId: string) => void;
}

export const HabitDetailModal: React.FC<HabitDetailModalProps> = ({
  isOpen,
  onClose,
  habit,
  onUpdateHabit,
  onDeleteHabit,
}) => {
  const { modalRef } = useModalFocus<HTMLDivElement>({ isOpen, onClose });

  const [vacationReason, setVacationReason] = useState('');
  const [vacationStart, setVacationStart] = useState(getLocalDateString());
  const [vacationEnd, setVacationEnd] = useState(getLocalDateString());

  if (!isOpen || !habit) return null;

  const analysis = analyzeHabitStrength(habit);
  const todayStr = getLocalDateString();
  const totalDays = Math.max(1, Math.round((Date.now() - habit.createdAt) / (1000 * 60 * 60 * 24)) + 1);

  const habitScoreResult = calculateHabitScore({
    completions: habit.completedDates?.length || 0,
    totalDueDates: totalDays,
    currentStreak: analysis.currentStreak,
    longestStreak: analysis.bestStreak,
  });

  const adaptiveSchedule = computeAdaptiveSchedule({
    completedDates: habit.completedDates || [],
    dueDates: [todayStr],
    skippedDates: (habit.vacationPeriods || []).flatMap((v) => [v.startDate, v.endDate]),
    targetDate: todayStr,
  });

  const handleAddVacation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vacationStart || !vacationEnd) return;

    const newVacation: VacationPeriod = {
      id: `vacation-${Date.now()}`,
      startDate: vacationStart,
      endDate: vacationEnd,
      reason: vacationReason.trim() || 'Vacation / Travel',
    };

    const updatedVacations = [...(habit.vacationPeriods || []), newVacation];
    onUpdateHabit({
      ...habit,
      vacationPeriods: updatedVacations,
    });

    setVacationReason('');
  };

  const handleRemoveVacation = (vacationId: string) => {
    const updatedVacations = (habit.vacationPeriods || []).filter((v) => v.id !== vacationId);
    onUpdateHabit({
      ...habit,
      vacationPeriods: updatedVacations,
    });
  };

  const handleScheduleTypeChange = (type: 'daily' | 'custom_days' | 'weekly_target') => {
    onUpdateHabit({
      ...habit,
      scheduleType: type,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="habit-detail-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl shadow-slate-900/10 w-full max-w-lg p-6 sm:p-7 space-y-6 my-8 animate-scaleUp text-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-700 shadow-xs">
              <Flame className="w-5 h-5 fill-emerald-600" />
            </div>
            <div>
              <h2 id="habit-detail-modal-title" className="text-lg font-extrabold text-slate-900 tracking-tight">
                {habit.name}
              </h2>
              <p className="text-xs text-slate-500 capitalize mt-0.5">
                {habit.category || 'Habit'} • Intelligence & Scoring
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Strength & Resilience Score Card */}
        <div className="p-4 rounded-xl bg-linear-to-br from-slate-900 to-slate-800 text-white shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>Habit Strength (Loop Engine)</span>
            </span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${analysis.levelBadgeColor}`}>
              {analysis.levelLabel}
            </span>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-extrabold tracking-tight">{analysis.strengthScore}%</span>
            <span className="text-xs text-slate-300">
              Resilience: <strong className="text-white">{analysis.resilienceRating}</strong>
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-700/60 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-emerald-400 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${analysis.strengthScore}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 text-center border-t border-slate-700/80 text-xs">
            <div>
              <p className="text-slate-400 text-[10px]">Active Streak</p>
              <p className="font-bold text-amber-400 flex items-center justify-center gap-1">
                <Flame className="w-3 h-3 fill-amber-400" />
                <span>{analysis.currentStreak}d</span>
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-[10px]">Best Streak</p>
              <p className="font-bold text-emerald-300 flex items-center justify-center gap-1">
                <Award className="w-3 h-3" />
                <span>{analysis.bestStreak}d</span>
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-[10px]">30-Day Consistency</p>
              <p className="font-bold text-blue-300">{analysis.monthlyCompletionRate}%</p>
            </div>
          </div>

          {/* Habit Intelligence & Adaptive Schedule Strip */}
          <div className="grid grid-cols-3 gap-2 pt-2 text-center border-t border-slate-700/60 text-xs bg-slate-800/50 -mx-4 -mb-3 p-3 rounded-b-xl">
            <div>
              <p className="text-slate-400 text-[10px]">Routine Health</p>
              <p className="font-bold text-purple-300">{habitScoreResult.healthLabel}</p>
            </div>
            <div>
              <p className="text-slate-400 text-[10px]">Today's Status</p>
              <p className="font-bold text-cyan-300 font-mono text-[11px]">{adaptiveSchedule.status}</p>
            </div>
            <div>
              <p className="text-slate-400 text-[10px]">Schedule Backlog</p>
              <p className={`font-bold ${habitScoreResult.backlogDays > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {habitScoreResult.backlogDays}d
              </p>
            </div>
          </div>
        </div>

        {/* Schedule Configuration */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Settings2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Schedule Mode</span>
          </label>
          <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleScheduleTypeChange('daily')}
              className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                (!habit.scheduleType || habit.scheduleType === 'daily')
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Every Day
            </button>
            <button
              type="button"
              onClick={() => handleScheduleTypeChange('weekly_target')}
              className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                habit.scheduleType === 'weekly_target'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {habit.targetDaysPerWeek}x / Week
            </button>
            <button
              type="button"
              onClick={() => handleScheduleTypeChange('custom_days')}
              className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                habit.scheduleType === 'custom_days'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Custom Days
            </button>
          </div>
        </div>

        {/* Vacation / Pause Mode */}
        <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Pause className="w-4 h-4 text-amber-700" />
              <h3 className="text-xs font-bold text-amber-900">Vacation / Pause Mode</h3>
            </div>
            <span className="text-[10px] text-amber-800 font-medium">Preserves streaks on travel</span>
          </div>

          <form onSubmit={handleAddVacation} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-amber-900 block">Start Date</label>
                <input
                  type="date"
                  value={vacationStart}
                  onChange={(e) => setVacationStart(e.target.value)}
                  className="w-full text-xs p-1.5 rounded-lg border border-amber-200 bg-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-amber-900 block">End Date</label>
                <input
                  type="date"
                  value={vacationEnd}
                  onChange={(e) => setVacationEnd(e.target.value)}
                  className="w-full text-xs p-1.5 rounded-lg border border-amber-200 bg-white"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Reason (e.g. Vacation, Travel)..."
                value={vacationReason}
                onChange={(e) => setVacationReason(e.target.value)}
                className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-amber-200 bg-white"
              />
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-bold text-amber-900 bg-amber-200 hover:bg-amber-300 rounded-lg transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Pause</span>
              </button>
            </div>
          </form>

          {/* Active Vacation Periods */}
          {habit.vacationPeriods && habit.vacationPeriods.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-[11px] font-bold text-amber-900">Registered Vacations:</p>
              {habit.vacationPeriods.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-amber-200/80"
                >
                  <div>
                    <span className="font-semibold text-amber-950">{v.reason}</span>
                    <span className="text-[11px] text-amber-700 block font-mono">
                      {v.startDate} to {v.endDate}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveVacation(v.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    aria-label="Remove vacation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => exportHabitsCsv([habit])}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (confirm(`Are you sure you want to delete "${habit.name}"?`)) {
                onDeleteHabit(habit.id);
                onClose();
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Habit</span>
          </button>
        </div>
      </div>
    </div>
  );
};
