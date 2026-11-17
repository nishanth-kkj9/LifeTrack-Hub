import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Flame,
  Award,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Trash2,
  Pause,
  TrendingUp,
  Settings2,
  Check,
  HelpCircle,
  Pencil,
  StickyNote,
  Bell,
} from 'lucide-react';
import { Habit, VacationPeriod } from '../../types/index.ts';
import {
  HABIT_CATEGORIES,
  WEEKDAYS_MON_FIRST,
  analyzeHabitStrength,
  formatCustomDaysLabel,
  getHabitTodayStatus,
  isDateInVacation,
  isHabitDueOnDate,
  sortCustomDaysMonFirst,
} from '../../lib/habitScoring.ts';
import { getMonthGrid } from '../../lib/calendarUtils.ts';
import { exportHabitsCsv } from '../../lib/dataExport.ts';
import { getLocalDateString, getLocalMonthPrefix, parseLocalDate } from '../../lib/dateUtils.ts';
import { useModalFocus } from '../../hooks/useModalFocus.ts';
import {
  isValidReminderTime,
  requestHabitReminderPermission,
} from '../../lib/habitReminders.ts';

interface HabitDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  habit: Habit | null;
  onUpdateHabit: (habit: Habit) => void;
  onDeleteHabit: (habitId: string) => void;
  onToggleHabitDate?: (habitId: string, dateStr: string) => void;
  todayStr?: string;
}

export const HabitDetailModal: React.FC<HabitDetailModalProps> = ({
  isOpen,
  onClose,
  habit,
  onUpdateHabit,
  onDeleteHabit,
  onToggleHabitDate,
  todayStr: todayStrProp,
}) => {
  const { modalRef } = useModalFocus<HTMLDivElement>({ isOpen, onClose });
  const effectiveToday = todayStrProp || getLocalDateString();

  const [vacationReason, setVacationReason] = useState('');
  const [vacationStart, setVacationStart] = useState(getLocalDateString());
  const [vacationEnd, setVacationEnd] = useState(getLocalDateString());
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [draftScheduleType, setDraftScheduleType] = useState<
    'daily' | 'weekly_target' | 'custom_days'
  >('daily');
  const [draftTargetDays, setDraftTargetDays] = useState<number>(7);
  const [draftCustomDays, setDraftCustomDays] = useState<number[]>([]);
  const [scheduleSavedNotice, setScheduleSavedNotice] = useState(false);
  const [showFormulaPopover, setShowFormulaPopover] = useState(false);

  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<string>('Personal');
  const [editTarget, setEditTarget] = useState<number>(7);
  const [editSavedNotice, setEditSavedNotice] = useState(false);
  const [reminderDraft, setReminderDraft] = useState<string>('');
  const [reminderSavedNotice, setReminderSavedNotice] = useState(false);

  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const d = parseLocalDate(effectiveToday);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [editingNoteDate, setEditingNoteDate] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const d = parseLocalDate(effectiveToday);
    setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setEditingNoteDate(null);
    setNoteDraft('');
  }, [isOpen, habit?.id, effectiveToday]);

  useEffect(() => {
    if (!habit) return;
    const type: 'daily' | 'weekly_target' | 'custom_days' =
      habit.scheduleType === 'weekly_target' || habit.scheduleType === 'custom_days'
        ? habit.scheduleType
        : 'daily';
    setDraftScheduleType(type);
    setDraftTargetDays(
      Math.max(1, Math.min(7, habit.targetDaysPerWeek || (type === 'weekly_target' ? 3 : 7)))
    );
    setDraftCustomDays(sortCustomDaysMonFirst(habit.customDays));
    setScheduleSavedNotice(false);
    setShowFormulaPopover(false);

    setEditName(habit.name || '');
    const rawCat = (habit.category || '').trim();
    const matchedCanonical = HABIT_CATEGORIES.find(
      (c) => c.toLowerCase() === rawCat.toLowerCase()
    );
    setEditCategory(matchedCanonical || rawCat || 'Personal');
    setEditTarget(Math.max(1, Math.min(7, habit.targetDaysPerWeek || 7)));
    setEditSavedNotice(false);
    setReminderDraft(isValidReminderTime(habit.reminderTime) ? habit.reminderTime : '');
    setReminderSavedNotice(false);
  }, [
    isOpen,
    habit?.id,
    habit?.name,
    habit?.category,
    habit?.scheduleType,
    habit?.targetDaysPerWeek,
    habit?.customDays,
    habit?.reminderTime,
  ]);

  if (!isOpen || !habit) return null;

  const todayStr = effectiveToday;
  const analysis = analyzeHabitStrength(habit, todayStr);
  const isWeeklyTarget = habit.scheduleType === 'weekly_target';
  const todayStatus = getHabitTodayStatus(habit, todayStr);

  const completedDates = Array.isArray(habit.completedDates) ? habit.completedDates : [];
  const habitNotes: Record<string, string> =
    habit.notes && typeof habit.notes === 'object' && !Array.isArray(habit.notes)
      ? habit.notes
      : {};
  const monthGridDates = getMonthGrid(viewMonth, 1);
  const activeMonthPrefix = getLocalMonthPrefix(viewMonth);
  const monthHeaderLabel = viewMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const handleToggleDay = (dateStr: string) => {
    if (dateStr > todayStr) return;
    if (onToggleHabitDate) {
      onToggleHabitDate(habit.id, dateStr);
      return;
    }
    const isDone = completedDates.includes(dateStr);
    const nextCompletedDates = isDone
      ? completedDates.filter((d) => d !== dateStr)
      : [...completedDates, dateStr];
    onUpdateHabit({
      ...habit,
      completedDates: nextCompletedDates,
    });
  };

  const openNoteEditor = (dateStr: string) => {
    if (dateStr > todayStr) return;
    setEditingNoteDate(dateStr);
    const existing = typeof habitNotes[dateStr] === 'string' ? habitNotes[dateStr] : '';
    setNoteDraft(existing.slice(0, 280));
  };

  const handleSaveDayNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNoteDate) return;
    const normalized = noteDraft.trim().slice(0, 280);
    const nextNotes: Record<string, string> = { ...habitNotes };
    if (normalized) {
      nextNotes[editingNoteDate] = normalized;
    } else {
      delete nextNotes[editingNoteDate];
    }
    const nextHabit: Habit = { ...habit };
    if (Object.keys(nextNotes).length > 0) {
      nextHabit.notes = nextNotes;
    } else {
      delete nextHabit.notes;
    }
    onUpdateHabit(nextHabit);
    setEditingNoteDate(null);
    setNoteDraft('');
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const trimmedEditName = editName.trim();
  const isEditNameValid = trimmedEditName.length > 0;
  const editCategoryOptions = HABIT_CATEGORIES.some(
    (c) => c.toLowerCase() === editCategory.trim().toLowerCase()
  )
    ? [...HABIT_CATEGORIES]
    : [...HABIT_CATEGORIES, editCategory];

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditNameValid) return;
    const clampedTarget = Math.max(1, Math.min(7, Math.round(Number(editTarget) || 7)));
    onUpdateHabit({
      ...habit,
      name: trimmedEditName,
      category: editCategory.trim() || 'Personal',
      targetDaysPerWeek: clampedTarget,
    });
    setEditName(trimmedEditName);
    setEditTarget(clampedTarget);
    setEditSavedNotice(true);
  };

  const handleAddVacation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vacationStart || !vacationEnd) return;
    const startDate = vacationStart <= vacationEnd ? vacationStart : vacationEnd;
    const endDate = vacationStart <= vacationEnd ? vacationEnd : vacationStart;

    const newVacation: VacationPeriod = {
      id: `vacation-${Date.now()}`,
      startDate,
      endDate,
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

  const handleToggleCustomDay = (day: number) => {
    setScheduleSavedNotice(false);
    setDraftCustomDays((prev) => {
      const next = prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day];
      return sortCustomDaysMonFirst(next);
    });
  };

  const isCustomDaysInvalid =
    draftScheduleType === 'custom_days' && draftCustomDays.length === 0;

  const handleSaveSchedule = () => {
    if (isCustomDaysInvalid) return;
    const orderedCustomDays = sortCustomDaysMonFirst(draftCustomDays);
    const clampedTarget = Math.max(1, Math.min(7, draftTargetDays));
    onUpdateHabit({
      ...habit,
      scheduleType: draftScheduleType,
      targetDaysPerWeek:
        draftScheduleType === 'weekly_target'
          ? clampedTarget
          : draftScheduleType === 'custom_days'
            ? orderedCustomDays.length
            : 7,
      ...(draftScheduleType === 'custom_days'
        ? { customDays: orderedCustomDays }
        : habit.customDays !== undefined
          ? { customDays: habit.customDays }
          : {}),
    });
    setScheduleSavedNotice(true);
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
        className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl shadow-slate-900/10 w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto p-5 sm:p-6 space-y-5 animate-scaleUp text-slate-900"
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
        <div className="relative p-4 rounded-xl bg-linear-to-br from-slate-900 to-slate-800 text-white shadow-md space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>Habit Strength (Loop Engine)</span>
              </span>
              <button
                type="button"
                onClick={() => setShowFormulaPopover((v) => !v)}
                aria-expanded={showFormulaPopover}
                className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-300 hover:text-white underline underline-offset-2 cursor-pointer"
              >
                <HelpCircle className="w-3 h-3" />
                <span>How is this calculated?</span>
              </button>
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border shrink-0 ${analysis.levelBadgeColor}`}>
              {analysis.levelLabel}
            </span>
          </div>

          {showFormulaPopover && (
            <div
              role="region"
              aria-label="Habit strength formula explanation"
              className="p-3 rounded-xl bg-slate-950/95 border border-slate-700 text-[11px] text-slate-200 leading-relaxed space-y-1.5 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">Loop Exponential Model</span>
                <button
                  type="button"
                  onClick={() => setShowFormulaPopover(false)}
                  aria-label="Close formula explanation"
                  className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p>
                Strength rises with each check and decays with each missed due day (vacation and rest days do not decay it).
              </p>
              <p className="text-slate-300">
                Benchmarks: <strong className="text-white">12 perfect days</strong> is about <strong className="text-white">47%</strong>, and <strong className="text-white">30 days</strong> is about <strong className="text-white">80%</strong>.
              </p>
            </div>
          )}

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
                <span>{analysis.currentStreak}{isWeeklyTarget ? 'w' : 'd'}</span>
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-[10px]">Best Streak</p>
              <p className="font-bold text-emerald-300 flex items-center justify-center gap-1">
                <Award className="w-3 h-3" />
                <span>{analysis.bestStreak}{isWeeklyTarget ? 'w' : 'd'}</span>
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-[10px]">{isWeeklyTarget ? '4-Week Consistency' : '30-Day Consistency'}</p>
              <p className="font-bold text-blue-300">{analysis.monthlyCompletionRate}%</p>
            </div>
          </div>

          {/* Habit Intelligence & Today's Status Strip */}
          <div className="grid grid-cols-3 gap-2 pt-2 text-center border-t border-slate-700/60 text-xs bg-slate-800/50 -mx-4 -mb-3 p-3 rounded-b-xl">
            <div>
              <p className="text-slate-400 text-[10px]">Routine Health</p>
              <p className="font-bold text-purple-300">{analysis.healthLabel}</p>
            </div>
            <div>
              <p className="text-slate-400 text-[10px]">Today's Status</p>
              <p
                className={`font-bold font-mono text-[11px] ${
                  todayStatus === 'COMPLETED'
                    ? 'text-emerald-300'
                    : todayStatus === 'DUE'
                      ? 'text-cyan-300'
                      : 'text-slate-300'
                }`}
              >
                {todayStatus}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-[10px]">{isWeeklyTarget ? 'Remaining This Week' : 'Schedule Backlog'}</p>
              <p className={`font-bold ${analysis.backlogDays > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {isWeeklyTarget ? `${analysis.backlogDays} left` : `${analysis.backlogDays}d`}
              </p>
            </div>
          </div>
        </div>

        {/* Month Calendar & Per-Day Notes */}
        <div
          data-testid="habit-detail-month-calendar"
          className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Month History & Back-fill</span>
            </h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() =>
                  setViewMonth(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                  )
                }
                className="p-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span
                data-testid="habit-calendar-month-label"
                className="text-xs font-bold text-slate-800 min-w-[110px] text-center"
              >
                {monthHeaderLabel}
              </span>
              <button
                type="button"
                aria-label="Next month"
                onClick={() =>
                  setViewMonth(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                  )
                }
                className="p-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS_MON_FIRST.map(({ label }) => (
              <div
                key={label}
                className="text-[10px] font-bold uppercase tracking-wider text-slate-400 py-0.5"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {monthGridDates.map((dateStr) => {
              const isCurrentMonth = dateStr.startsWith(activeMonthPrefix);
              const isFuture = dateStr > todayStr;
              const isToday = dateStr === todayStr;
              const isDone = completedDates.includes(dateStr);
              const isVacation = isDateInVacation(dateStr, habit.vacationPeriods);
              const isDue = isHabitDueOnDate(habit, dateStr);
              const status: 'done' | 'missed' | 'rest' | 'future' = isFuture
                ? 'future'
                : isDone
                  ? 'done'
                  : isVacation || !isDue
                    ? 'rest'
                    : 'missed';
              const dayNum = parseLocalDate(dateStr).getDate();
              const dayNote = typeof habitNotes[dateStr] === 'string' ? habitNotes[dateStr] : '';
              const statusText =
                status === 'done'
                  ? 'done'
                  : status === 'rest'
                    ? 'rest'
                    : status === 'future'
                      ? 'future'
                      : 'missed';

              return (
                <div
                  key={dateStr}
                  data-testid={`habit-calendar-cell-${dateStr}`}
                  data-day-status={status}
                  className={`relative rounded-lg border p-0.5 flex flex-col items-center justify-between min-h-[42px] transition ${
                    status === 'done'
                      ? 'bg-emerald-500 border-emerald-600 text-white shadow-2xs'
                      : status === 'rest'
                        ? 'bg-amber-50/80 border-amber-200/80 text-amber-900'
                        : status === 'future'
                          ? 'bg-slate-100/70 border-slate-200/60 text-slate-300'
                          : 'bg-white border-rose-200 text-slate-700 hover:bg-rose-50/60'
                  } ${!isCurrentMonth ? 'opacity-55' : ''} ${
                    isToday ? 'ring-2 ring-indigo-500 ring-offset-1' : ''
                  }`}
                >
                  <button
                    type="button"
                    data-testid={`habit-calendar-day-btn-${dateStr}`}
                    disabled={isFuture}
                    aria-label={`${dateStr}, ${statusText}${dayNote ? `, note: ${dayNote}` : ''}`}
                    aria-pressed={status === 'done'}
                    onPointerDown={() => {
                      if (isFuture) return;
                      longPressTriggeredRef.current = false;
                      clearLongPress();
                      longPressTimerRef.current = setTimeout(() => {
                        longPressTriggeredRef.current = true;
                        openNoteEditor(dateStr);
                      }, 450);
                    }}
                    onPointerUp={clearLongPress}
                    onPointerLeave={clearLongPress}
                    onPointerCancel={clearLongPress}
                    onClick={() => {
                      if (isFuture) return;
                      if (longPressTriggeredRef.current) {
                        longPressTriggeredRef.current = false;
                        return;
                      }
                      handleToggleDay(dateStr);
                    }}
                    title={
                      isFuture
                        ? `${dateStr} (future)`
                        : `${dateStr} • ${statusText}${dayNote ? ` • ${dayNote}` : ''}`
                    }
                    className={`w-full flex-1 flex flex-col items-center justify-center rounded text-[11px] font-bold tabular-nums leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                      isFuture ? 'cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    <span>{dayNum}</span>
                    <span className="text-[8px] font-semibold uppercase tracking-tight mt-0.5 opacity-85">
                      {status === 'done'
                        ? '✓'
                        : status === 'rest'
                          ? 'rest'
                          : status === 'future'
                            ? '·'
                            : '×'}
                    </span>
                  </button>

                  {!isFuture && (
                    <button
                      type="button"
                      data-testid={`habit-day-note-btn-${dateStr}`}
                      aria-label={dayNote ? `Edit note for ${dateStr}` : `Add note for ${dateStr}`}
                      title={dayNote ? `Note: ${dayNote}` : `Add note for ${dateStr}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openNoteEditor(dateStr);
                      }}
                      className={`absolute top-0.5 right-0.5 p-0.5 rounded transition cursor-pointer ${
                        dayNote
                          ? status === 'done'
                            ? 'text-yellow-200 hover:text-white'
                            : 'text-indigo-600 hover:text-indigo-800'
                          : status === 'done'
                            ? 'text-emerald-100/80 hover:text-white'
                            : 'text-slate-300 hover:text-slate-600'
                      }`}
                    >
                      <StickyNote className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500 pt-0.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" /> Done
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-white border border-rose-300 inline-block" /> Missed
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-amber-100 border border-amber-300 inline-block" /> Rest
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-slate-200 inline-block" /> Future
              </span>
            </div>
            <span>Click day to toggle • Long-press or note icon for note</span>
          </div>

          {editingNoteDate && (
            <form
              onSubmit={handleSaveDayNote}
              data-testid="habit-day-note-editor"
              className="p-2.5 rounded-xl bg-white border border-indigo-200 space-y-2 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <label
                  htmlFor="habit-day-note-input"
                  className="text-[11px] font-bold text-slate-800"
                >
                  Note for {editingNoteDate}
                </label>
                <span
                  data-testid="habit-day-note-counter"
                  className="text-[10px] font-mono text-slate-400 tabular-nums"
                >
                  {noteDraft.length}/280
                </span>
              </div>
              <textarea
                id="habit-day-note-input"
                rows={2}
                maxLength={280}
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value.slice(0, 280))}
                placeholder="Add reflection or context for this day (max 280 chars)..."
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
              />
              <div className="flex items-center justify-end gap-1.5">
                {habitNotes[editingNoteDate] && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextNotes: Record<string, string> = { ...habitNotes };
                      delete nextNotes[editingNoteDate];
                      const nextHabit: Habit = { ...habit };
                      if (Object.keys(nextNotes).length > 0) {
                        nextHabit.notes = nextNotes;
                      } else {
                        delete nextHabit.notes;
                      }
                      onUpdateHabit(nextHabit);
                      setEditingNoteDate(null);
                      setNoteDraft('');
                    }}
                    className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                  >
                    Remove
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditingNoteDate(null);
                    setNoteDraft('');
                  }}
                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="habit-day-note-save-btn"
                  className="px-3 py-1 text-[11px] font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Save Note
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Edit Habit Details */}
        <form onSubmit={handleSaveEdit} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Pencil className="w-3.5 h-3.5 text-slate-500" />
              <span>Edit</span>
            </h3>
            {editSavedNotice && (
              <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                <Check className="w-3 h-3" />
                Updated
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
            <div className="sm:col-span-5">
              <label htmlFor="habit-edit-name-input" className="text-[10px] font-semibold text-slate-600 block mb-1">
                Name
              </label>
              <input
                id="habit-edit-name-input"
                type="text"
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
                  setEditSavedNotice(false);
                }}
                placeholder="Habit name..."
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div className="sm:col-span-4">
              <label htmlFor="habit-edit-category-select" className="text-[10px] font-semibold text-slate-600 block mb-1">
                Category
              </label>
              <select
                id="habit-edit-category-select"
                value={editCategory}
                onChange={(e) => {
                  setEditCategory(e.target.value);
                  setEditSavedNotice(false);
                }}
                className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
              >
                {editCategoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3 flex items-end gap-1.5">
              <div className="flex-1">
                <label htmlFor="habit-edit-target-input" className="text-[10px] font-semibold text-slate-600 block mb-1">
                  Target
                </label>
                <input
                  id="habit-edit-target-input"
                  type="number"
                  min={1}
                  max={7}
                  value={editTarget}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setEditTarget(Number.isFinite(val) ? val : 1);
                    setEditSavedNotice(false);
                  }}
                  className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 tabular-nums"
                />
              </div>
              <button
                type="submit"
                id="habit-edit-save-btn"
                disabled={!isEditNameValid}
                className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                Save
              </button>
            </div>
          </div>
          {!isEditNameValid && (
            <p className="text-[11px] font-semibold text-rose-600">
              Habit name is required
            </p>
          )}
        </form>

        {/* Optional Daily Reminder */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!isValidReminderTime(reminderDraft)) return;
            requestHabitReminderPermission();
            onUpdateHabit({
              ...habit,
              reminderTime: reminderDraft,
            });
            setReminderSavedNotice(true);
          }}
          className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <Bell className="w-3.5 h-3.5 text-slate-500" />
            <div>
              <label
                htmlFor="habit-reminder-time-input"
                className="text-xs font-bold text-slate-800 block"
              >
                Daily Reminder (optional)
              </label>
              <span className="text-[10px] text-slate-500">
                Notifies while app is open if habit is due & unchecked
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {reminderSavedNotice && (
              <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-0.5 mr-1">
                <Check className="w-3 h-3" />
                Saved
              </span>
            )}
            <input
              id="habit-reminder-time-input"
              type="time"
              value={reminderDraft}
              onChange={(e) => {
                setReminderDraft(e.target.value);
                setReminderSavedNotice(false);
              }}
              className="text-xs px-2 py-1 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 tabular-nums"
            />
            <button
              type="submit"
              id="habit-reminder-save-btn"
              disabled={!isValidReminderTime(reminderDraft)}
              className="px-2.5 py-1 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Set Reminder
            </button>
            {(habit.reminderTime || reminderDraft) && (
              <button
                type="button"
                id="habit-reminder-clear-btn"
                onClick={() => {
                  const nextHabit: Habit = { ...habit };
                  delete nextHabit.reminderTime;
                  onUpdateHabit(nextHabit);
                  setReminderDraft('');
                  setReminderSavedNotice(false);
                }}
                className="px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-lg transition cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </form>

        {/* Schedule Configuration */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Schedule Mode</span>
            </label>
            {scheduleSavedNotice && (
              <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                <Check className="w-3 h-3" />
                Saved
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setDraftScheduleType('daily');
                setScheduleSavedNotice(false);
              }}
              className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                draftScheduleType === 'daily'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Every Day
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftScheduleType('weekly_target');
                setScheduleSavedNotice(false);
              }}
              className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                draftScheduleType === 'weekly_target'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {draftTargetDays}x / Week
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftScheduleType('custom_days');
                setScheduleSavedNotice(false);
              }}
              className={`p-2.5 rounded-xl border text-center transition cursor-pointer truncate px-2 ${
                draftScheduleType === 'custom_days'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
              title={draftCustomDays.length > 0 ? formatCustomDaysLabel(draftCustomDays) : 'Custom Days'}
            >
              {draftCustomDays.length > 0 ? formatCustomDaysLabel(draftCustomDays) : 'Custom Days'}
            </button>
          </div>

          {draftScheduleType === 'weekly_target' && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-800">Weekly target</p>
                <p className="text-[11px] text-slate-500">Any {draftTargetDays} {draftTargetDays === 1 ? 'day' : 'days'} per Mon–Sun week</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Decrease target days per week"
                  disabled={draftTargetDays <= 1}
                  onClick={() => {
                    setDraftTargetDays((v) => Math.max(1, v - 1));
                    setScheduleSavedNotice(false);
                  }}
                  className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  -
                </button>
                <span
                  data-testid="habit-weekly-target-value"
                  className="min-w-[3rem] text-center text-xs font-extrabold text-slate-900 tabular-nums"
                >
                  {draftTargetDays} / 7
                </span>
                <button
                  type="button"
                  aria-label="Increase target days per week"
                  disabled={draftTargetDays >= 7}
                  onClick={() => {
                    setDraftTargetDays((v) => Math.min(7, v + 1));
                    setScheduleSavedNotice(false);
                  }}
                  className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {draftScheduleType === 'custom_days' && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-800">Repeat on weekdays</p>
                {draftCustomDays.length === 0 && (
                  <span className="text-[11px] font-semibold text-rose-600">
                    Select at least one day
                  </span>
                )}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAYS_MON_FIRST.map(({ day, label }) => {
                  const selected = draftCustomDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => handleToggleCustomDay(day)}
                      className={`py-1.5 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                        selected
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveSchedule}
              disabled={isCustomDaysInvalid}
              className="px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save
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

          {confirmingDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-rose-700">Delete habit?</span>
              <button
                type="button"
                onClick={() => {
                  onDeleteHabit(habit.id);
                  setConfirmingDelete(false);
                  onClose();
                }}
                className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition cursor-pointer"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              aria-label={`Delete habit ${habit.name}`}
              onClick={() => setConfirmingDelete(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer min-h-[44px] sm:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Habit</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
