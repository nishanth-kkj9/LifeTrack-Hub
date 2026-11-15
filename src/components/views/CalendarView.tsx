import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  Plus,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Task, TaskPriority, ExamReminder } from '../../types/index.ts';
import { ActiveTab } from '../Navigation.tsx';
import { Button } from '../ui/Button.tsx';
import { TaskRow } from '../ui/TaskRow.tsx';
import { TimeGrid } from '../common/TimeGrid.tsx';
import { useTimeFormat } from '../../hooks/useTimeFormat.ts';
import { useModalFocus } from '../../hooks/useModalFocus.ts';
import {
  getLocalDateString,
  getLocalDateOffset,
  getLocalMonthPrefix,
  formatAppTime,
  formatDisplayDate,
  parseLocalDate,
  getWeekStartPreference,
  type WeekStart,
} from '../../lib/dateUtils.ts';
import {
  buildDayBuckets,
  getMonthGrid,
  getWeekDays,
  monthStats,
  getOverdueTasks,
  buildAgendaGroups,
  shiftMonthKeepingDay,
  formatCalendarCellAriaLabel,
  computeCalendarKeyNavigation,
  projectRecurringOccurrences,
  type ProjectedRepeat,
} from '../../lib/calendarUtils.ts';

const PRIORITY_ORDER: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];

const PRIORITY_RANK: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const TASK_CHIP_PRIORITY_CLASSES: Record<TaskPriority, string> = {
  urgent: 'border-l-rose-500 bg-rose-50/80 text-slate-800',
  high: 'border-l-amber-500 bg-amber-50/80 text-slate-800',
  medium: 'border-l-indigo-500 bg-indigo-50/80 text-slate-800',
  low: 'border-l-slate-400 bg-slate-100/80 text-slate-700',
};

const PRIORITY_DOT_CLASSES: Record<TaskPriority, string> = {
  urgent: 'bg-rose-500',
  high: 'bg-amber-500',
  medium: 'bg-indigo-500',
  low: 'bg-slate-400',
};

const WEEKDAY_HEADERS_SUN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_HEADERS_MON = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Module-level persistence across tab switches
let persistedSelectedDate: string | null = null;
let persistedViewMonth: Date | null = null;

export function resetCalendarViewState(): void {
  persistedSelectedDate = null;
  persistedViewMonth = null;
}

interface CalendarViewProps {
  tasks: Task[];
  exams: ExamReminder[];
  onToggleTask: (taskId: string) => void;
  onUpdateTask?: (updatedTask: Task) => void;
  onSelectTask?: (task: Task) => void;
  onOpenAddTaskModal: (defaults?: { dueDate?: string; dueTime?: string }) => void;
  onNavigateTab?: (tab: ActiveTab) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  tasks,
  exams,
  onToggleTask,
  onUpdateTask,
  onSelectTask,
  onOpenAddTaskModal,
  onNavigateTab,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(
    () => persistedSelectedDate ?? getLocalDateString()
  );
  const [viewMonth, setViewMonth] = useState<Date>(() =>
    persistedViewMonth
      ? new Date(persistedViewMonth.getFullYear(), persistedViewMonth.getMonth(), 1)
      : new Date()
  );
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'agenda'>('month');
  const [isOverdueOpen, setIsOverdueOpen] = useState(true);
  const [showCompletedInAgenda, setShowCompletedInAgenda] = useState(false);
  const [showFutureRepeats, setShowFutureRepeats] = useState(false);
  const [agendaRangeDays, setAgendaRangeDays] = useState<7 | 30 | 90>(30);
  const [weekStartPref, setWeekStartPref] = useState<WeekStart>(() => getWeekStartPreference());
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [moveTaskState, setMoveTaskState] = useState<{ task: Task; date: string } | null>(null);
  const timeFormat = useTimeFormat();

  const cellRefs = useRef<Map<string, HTMLElement>>(new Map());
  const pendingFocusDateRef = useRef<string | null>(null);
  const moveDateInputRef = useRef<HTMLInputElement | null>(null);
  const { containerRef: moveDialogRef } = useModalFocus<HTMLDivElement>({
    isOpen: moveTaskState !== null,
    onClose: () => setMoveTaskState(null),
    initialFocusRef: moveDateInputRef,
  });

  useEffect(() => {
    persistedSelectedDate = selectedDate;
  }, [selectedDate]);

  useEffect(() => {
    persistedViewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  }, [viewMonth]);

  useEffect(() => {
    const syncWeekStart = () => {
      setWeekStartPref(getWeekStartPreference());
    };
    window.addEventListener('lifetrack-week-start-changed', syncWeekStart);
    window.addEventListener('storage', syncWeekStart);
    return () => {
      window.removeEventListener('lifetrack-week-start-changed', syncWeekStart);
      window.removeEventListener('storage', syncWeekStart);
    };
  }, []);

  const weekStartNum: 0 | 1 = weekStartPref === 'mon' ? 1 : 0;
  const weekdayHeaders = weekStartNum === 1 ? WEEKDAY_HEADERS_MON : WEEKDAY_HEADERS_SUN;

  const handlePrevPeriod = useCallback(() => {
    if (viewMode === 'week') {
      const nextDateStr = getLocalDateOffset(-7, parseLocalDate(selectedDate));
      const d = parseLocalDate(nextDateStr);
      setSelectedDate(nextDateStr);
      setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
      return;
    }
    const targetMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1);
    const { nextViewMonth, nextSelectedDate } = shiftMonthKeepingDay(selectedDate, targetMonth);
    setViewMonth(nextViewMonth);
    setSelectedDate(nextSelectedDate);
  }, [viewMode, viewMonth, selectedDate]);

  const handleNextPeriod = useCallback(() => {
    if (viewMode === 'week') {
      const nextDateStr = getLocalDateOffset(7, parseLocalDate(selectedDate));
      const d = parseLocalDate(nextDateStr);
      setSelectedDate(nextDateStr);
      setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
      return;
    }
    const targetMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
    const { nextViewMonth, nextSelectedDate } = shiftMonthKeepingDay(selectedDate, targetMonth);
    setViewMonth(nextViewMonth);
    setSelectedDate(nextSelectedDate);
  }, [viewMode, viewMonth, selectedDate]);

  const handleToday = useCallback(() => {
    const today = new Date();
    setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(getLocalDateString(today));
  }, []);

  // Global keyboard shortcuts: t = today, m = month, w = week, a = agenda (ignored in inputs / chips / modals)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable ||
          Boolean(target.closest?.('[data-testid="calendar-task-chip"]'))
        ) {
          return;
        }
      }
      if (document.querySelector('[role="dialog"]')) return;

      const lower = e.key.toLowerCase();
      if (lower === 't') {
        e.preventDefault();
        handleToday();
      } else if (lower === 'm') {
        e.preventDefault();
        setViewMode('month');
      } else if (lower === 'w') {
        e.preventDefault();
        setViewMode('week');
      } else if (lower === 'a') {
        e.preventDefault();
        setViewMode('agenda');
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleToday]);

  // Single-pass month grid + day buckets calculation
  const monthGrid = useMemo(() => getMonthGrid(viewMonth, weekStartNum), [viewMonth, weekStartNum]);
  const weekDays = useMemo(() => getWeekDays(selectedDate, weekStartNum), [selectedDate, weekStartNum]);

  const dayBuckets = useMemo(() => {
    const startYmd = monthGrid[0];
    const endYmd = monthGrid[monthGrid.length - 1];
    return buildDayBuckets(tasks, exams, startYmd, endYmd);
  }, [tasks, exams, monthGrid]);

  const projectedRepeatsMap = useMemo<Map<string, ProjectedRepeat[]>>(() => {
    if (!showFutureRepeats) return new Map();
    const startYmd = monthGrid[0];
    const endYmd = monthGrid[monthGrid.length - 1];
    return projectRecurringOccurrences(tasks, startYmd, endYmd);
  }, [showFutureRepeats, tasks, monthGrid]);

  const calendarDays = useMemo(() => {
    const todayStr = getLocalDateString();
    const activeMonthPrefix = getLocalMonthPrefix(viewMonth);

    return monthGrid.map((dateStr) => {
      const bucket = dayBuckets.get(dateStr);
      const dayNumber = parseInt(dateStr.slice(8, 10), 10);
      const dayExams = bucket?.exams || [];
      const pendingTasks = [...(bucket?.pending || [])].sort(
        (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      );
      const doneTasks = [...(bucket?.done || [])].sort(
        (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      );
      const dayTasks = [...pendingTasks, ...doneTasks];
      const dayProjectedRepeats = projectedRepeatsMap.get(dateStr) || [];

      const priorityDots = PRIORITY_ORDER.filter((p) =>
        dayTasks.some((t) => t.priority === p)
      )
        .slice(0, 3)
        .map((p) => ({
          priority: p,
          allDone: dayTasks.filter((t) => t.priority === p).every((t) => t.completed),
        }));

      const isPastDay = dateStr < todayStr;
      const hasOverduePast = isPastDay && (bucket?.overdue ?? false);

      return {
        dateStr,
        dayNumber,
        isCurrentMonth: dateStr.startsWith(activeMonthPrefix),
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        taskCount: pendingTasks.length,
        completedCount: doneTasks.length,
        tasks: dayTasks,
        projectedRepeats: dayProjectedRepeats,
        priorityDots,
        hasOverdue: bucket?.overdue ?? false,
        hasOverduePast,
        exams: dayExams,
        hasExam: dayExams.length > 0,
        examTitle: dayExams[0]?.subject,
      };
    });
  }, [monthGrid, dayBuckets, projectedRepeatsMap, viewMonth, selectedDate]);

  const calendarRows = useMemo(() => {
    const rows: Array<typeof calendarDays> = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      rows.push(calendarDays.slice(i, i + 7));
    }
    return rows;
  }, [calendarDays]);

  const activeTabStopDate = useMemo(() => {
    if (calendarDays.some((d) => d.dateStr === selectedDate)) {
      return selectedDate;
    }
    return calendarDays[0]?.dateStr ?? selectedDate;
  }, [calendarDays, selectedDate]);

  // Move focus to target gridcell after keyboard navigation updates selectedDate/viewMonth
  useEffect(() => {
    const targetDate = pendingFocusDateRef.current;
    if (!targetDate) return;
    const btn = cellRefs.current.get(targetDate);
    if (btn) {
      btn.focus();
      pendingFocusDateRef.current = null;
    }
  }, [selectedDate, calendarDays]);

  const handleGridCellKeyDown = (e: React.KeyboardEvent<HTMLElement>, dateStr: string) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelectDayCell(dateStr, dateStr.startsWith(getLocalMonthPrefix(viewMonth)));
      return;
    }

    const nav = computeCalendarKeyNavigation(e.key, dateStr, weekStartNum);
    if (!nav) return;

    e.preventDefault();
    pendingFocusDateRef.current = nav.nextDateStr;
    setSelectedDate(nav.nextDateStr);

    if (
      nav.nextViewMonth.getFullYear() !== viewMonth.getFullYear() ||
      nav.nextViewMonth.getMonth() !== viewMonth.getMonth()
    ) {
      setViewMonth(nav.nextViewMonth);
    }
  };

  const handleSelectDayCell = (dateStr: string, isCurrentMonth: boolean) => {
    setSelectedDate(dateStr);
    if (!isCurrentMonth) {
      const clickedDate = parseLocalDate(dateStr);
      setViewMonth(new Date(clickedDate.getFullYear(), clickedDate.getMonth(), 1));
    }
  };

  // Tasks on selected date
  const selectedDateTasks = useMemo(() => {
    return tasks.filter((t) => t.dueDate === selectedDate);
  }, [tasks, selectedDate]);

  // Exams on selected date
  const selectedDateExams = useMemo(() => {
    return exams.filter((e) => e.examDate === selectedDate);
  }, [exams, selectedDate]);

  // Collapsible Overdue list (pending tasks with dueDate < today, oldest first)
  const overdueTasks = useMemo(() => getOverdueTasks(tasks), [tasks]);

  // Grouped agenda events across 7/30/90 days
  const agendaGroups = useMemo(
    () =>
      buildAgendaGroups(tasks, exams, {
        rangeDays: agendaRangeDays,
        showCompleted: showCompletedInAgenda,
      }),
    [tasks, exams, agendaRangeDays, showCompletedInAgenda]
  );

  const totalAgendaEvents = useMemo(
    () => agendaGroups.reduce((sum, group) => sum + group.items.length, 0),
    [agendaGroups]
  );

  // Month stats computed from buckets
  const stats = useMemo(() => monthStats(dayBuckets, viewMonth), [dayBuckets, viewMonth]);

  const monthName = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const weekRangeLabel = useMemo(() => {
    const start = parseLocalDate(weekDays[0]);
    const end = parseLocalDate(weekDays[6]);
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} – ${endStr}`;
  }, [weekDays]);
  const selectedFormatted = parseLocalDate(selectedDate).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div id="calendar-view" className="space-y-6 animate-fadeIn pb-12">
      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 bg-gradient-to-b from-white to-slate-50/50 p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-slate-900 text-white shadow-xs">
              <CalendarIcon className="w-5 h-5 text-emerald-400 stroke-[2.2]" />
            </span>
            <span>Calendar & Schedule</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Plan deadlines and exam dates.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Segmented Switcher */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/70 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'month'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'week'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setViewMode('agenda')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'agenda'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Agenda
            </button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleToday}
            className="bg-white hover:bg-slate-50 border-slate-200 font-semibold shadow-2xs"
          >
            Today
          </Button>

          <div className="flex items-center bg-slate-100/80 rounded-xl p-1 border border-slate-200/70">
            <button
              type="button"
              id="calendar-prev-month-btn"
              onClick={handlePrevPeriod}
              className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
              aria-label={viewMode === 'week' ? 'Previous week' : 'Previous month'}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold px-3 min-w-[120px] text-center text-slate-800">
              {viewMode === 'week' ? weekRangeLabel : monthName}
            </span>
            <button
              type="button"
              id="calendar-next-month-btn"
              onClick={handleNextPeriod}
              className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
              aria-label={viewMode === 'week' ? 'Next week' : 'Next month'}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => onOpenAddTaskModal({ dueDate: selectedDate })}
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-xs"
          >
            Add Task
          </Button>
        </div>
      </div>

      {/* Month Metrics Overview Strip */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-2.5 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] min-w-0 overflow-hidden">
          <div className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">Scheduled Deadlines</div>
          <div className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {stats.pending}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">Due in {monthName.split(' ')[0]}</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-2.5 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] min-w-0 overflow-hidden">
          <div className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">Exams Scheduled</div>
          <div className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-indigo-600 mt-1">
            {stats.exams}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">University & Class tests</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-2.5 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] min-w-0 overflow-hidden">
          <div className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">Completed in Month</div>
          <div className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-emerald-600 mt-1">
            {stats.done}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">Tasks checked off</div>
        </div>
      </div>

      {/* Collapsible Overdue List above both Month and Agenda views */}
      {overdueTasks.length > 0 && (
        <section
          id="calendar-overdue-section"
          className="bg-rose-50/50 rounded-2xl border border-rose-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden min-w-0"
        >
          <button
            type="button"
            id="calendar-overdue-toggle"
            aria-expanded={isOverdueOpen}
            onClick={() => setIsOverdueOpen((prev) => !prev)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-rose-50/80 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="text-sm font-bold text-rose-900">
                Overdue ({overdueTasks.length})
              </span>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-rose-600 shrink-0 transition-transform ${
                isOverdueOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {isOverdueOpen && (
            <div
              id="calendar-overdue-list"
              className="divide-y divide-rose-100 border-t border-rose-200/60 bg-white"
            >
              {overdueTasks.map((task) => {
                const todayStr = getLocalDateString();
                return (
                  <div
                    key={task.id}
                    data-testid="calendar-overdue-row"
                    className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 px-4 py-2.5 hover:bg-slate-50/80 transition-colors min-w-0"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onToggleTask(task.id)}
                        className="w-4 h-4 rounded border border-slate-300 hover:border-emerald-600 bg-white shrink-0 flex items-center justify-center cursor-pointer"
                        aria-label={`Complete ${task.title}`}
                      />
                      <button
                        type="button"
                        onClick={() => onSelectTask?.(task)}
                        className="min-w-0 text-left flex-1 cursor-pointer"
                      >
                        <p className="text-xs font-semibold text-slate-900 truncate">
                          {task.title}
                        </p>
                        <p className="text-[11px] text-rose-600 font-medium mt-0.5 truncate">
                          Due {formatDisplayDate(task.dueDate)}
                          {task.dueTime ? ` · ${formatAppTime(task.dueTime, timeFormat)}` : ''}
                        </p>
                      </button>
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => onUpdateTask?.({ ...task, dueDate: todayStr })}
                      className="shrink-0 text-[11px] px-2.5 py-1 bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border-slate-200 font-semibold"
                    >
                      Move to today
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* View Mode: Month vs Agenda */}
      {viewMode === 'agenda' ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Upcoming {agendaRangeDays}-Day Agenda
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Chronological timeline of all scheduled tasks and university exam dates.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Range Selector: 7 / 30 / 90 days */}
              <div
                role="group"
                aria-label="Agenda date range"
                className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/70 text-xs font-semibold"
              >
                {([7, 30, 90] as const).map((days) => (
                  <button
                    key={days}
                    type="button"
                    aria-pressed={agendaRangeDays === days}
                    onClick={() => setAgendaRangeDays(days)}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      agendaRangeDays === days
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {days} days
                  </button>
                ))}
              </div>

              {/* Show Completed Toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={showCompletedInAgenda}
                onClick={() => setShowCompletedInAgenda((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  showCompletedInAgenda
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${
                    showCompletedInAgenda ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                />
                <span>Show completed</span>
              </button>

              <span className="text-xs font-bold font-mono tabular-nums text-slate-700 bg-slate-100 px-2.5 py-1.5 rounded-xl">
                {totalAgendaEvents} Events
              </span>
            </div>
          </div>

          {agendaGroups.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-semibold text-slate-800">No scheduled upcoming events</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Assign due dates to tasks or add exam dates to populate your agenda.
              </p>
              <Button
                variant="secondary"
                size="sm"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => onOpenAddTaskModal()}
                className="mt-4"
              >
                Schedule a Task
              </Button>
            </div>
          ) : (
            <div className="max-h-[65vh] overflow-y-auto rounded-xl border border-slate-200/70 divide-y divide-slate-200/70">
              {agendaGroups.map((group) => (
                <div key={group.date} data-testid={`agenda-group-${group.date}`}>
                  <div
                    data-testid="agenda-sticky-header"
                    className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs px-3.5 py-2 border-b border-slate-200/70 flex items-center justify-between"
                  >
                    <span className="text-xs font-bold text-slate-800">
                      {group.headerLabel}
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-slate-500">
                      {group.items.length}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 bg-white">
                    {group.items.map((evt) => {
                      const isExam = evt.type === 'exam';
                      const isDone = Boolean(evt.completed);

                      if (isExam) {
                        return (
                          <button
                            key={`${evt.type}-${evt.id}`}
                            type="button"
                            data-testid="agenda-exam-row"
                            onClick={() => onNavigateTab?.('academics')}
                            className="w-full text-left py-3 px-3.5 transition-colors flex items-center justify-between gap-3 cursor-pointer bg-indigo-50/70 hover:bg-indigo-100/60 border-l-4 border-l-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                                <GraduationCap className="w-4 h-4" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs truncate font-bold text-indigo-950">
                                    Exam: {evt.title}
                                  </span>
                                  <span className="shrink-0 text-[10px] font-bold text-indigo-700 bg-indigo-100 border border-indigo-200 px-1.5 py-0.5 rounded">
                                    Exam
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                                  {evt.time && (
                                    <>
                                      <span>{formatAppTime(evt.time, timeFormat)}</span>
                                      <span aria-hidden="true">·</span>
                                    </>
                                  )}
                                  <span className="capitalize">
                                    {evt.courseCode || 'Academic'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      }

                      return (
                        <div
                          key={`${evt.type}-${evt.id}`}
                          data-testid="agenda-task-row"
                          onClick={() => {
                            if (evt.taskRef && onSelectTask) {
                              onSelectTask(evt.taskRef);
                            }
                            setSelectedDate(evt.date);
                          }}
                          className={`py-3 px-3.5 transition-colors flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 ${
                            isDone ? 'opacity-60' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleTask(evt.id);
                              }}
                              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                                isDone
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'border-slate-300 hover:border-emerald-600 bg-white'
                              }`}
                              aria-label={`${isDone ? 'Reopen' : 'Complete'} ${evt.title}`}
                            >
                              <CheckCircle2
                                className={`w-3.5 h-3.5 ${
                                  isDone ? 'text-white' : 'text-slate-300 hover:text-emerald-600'
                                }`}
                              />
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`text-xs truncate ${
                                    isDone
                                      ? 'font-semibold text-slate-500 line-through'
                                      : 'font-semibold text-slate-900'
                                  }`}
                                >
                                  {evt.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                                <span>
                                  {evt.time ? formatAppTime(evt.time, timeFormat) : 'All day'}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="capitalize">{evt.category}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : viewMode === 'week' ? (
        <div data-testid="calendar-week-view" className="min-w-0">
          <TimeGrid
            days={weekDays}
            tasks={tasks}
            exams={exams}
            selectedDate={selectedDate}
            showAllDayRow
            onSelectTask={onSelectTask}
            onSelectExam={() => onNavigateTab?.('academics')}
            onCreateAt={(dueDate, dueTime) => onOpenAddTaskModal({ dueDate, dueTime })}
          />
        </div>
      ) : (
        /* Grid: 2 cols - Left is Calendar Month, Right is Day Agenda */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Month View Card (7 cols) */}
          <div
            role="grid"
            aria-label={`${monthName} calendar`}
            className="lg:col-span-7 min-w-0 overflow-hidden bg-white rounded-2xl border border-slate-200/90 p-2 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
          >
            {/* Month Grid Toolbar: Show future repeats toggle */}
            <div className="flex items-center justify-between gap-2 pb-2.5 mb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700 truncate">{monthName}</span>
              <button
                type="button"
                id="calendar-show-repeats-toggle"
                role="switch"
                aria-checked={showFutureRepeats}
                onClick={() => setShowFutureRepeats((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer shrink-0 ${
                  showFutureRepeats
                    ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    showFutureRepeats ? 'bg-indigo-600' : 'bg-slate-300'
                  }`}
                />
                <span>Show future repeats</span>
              </button>
            </div>

            {/* Day of Week Headers */}
            <div role="row" className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center mb-2">
              {weekdayHeaders.map((d) => (
                <div
                  key={d}
                  role="columnheader"
                  className="text-[11px] sm:text-xs font-semibold text-slate-400 py-1 min-w-0 truncate"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="space-y-1 sm:space-y-1.5">
              {calendarRows.map((weekRow, rowIdx) => (
                <div key={weekRow[0]?.dateStr || rowIdx} role="row" className="grid grid-cols-7 gap-1 sm:gap-1.5">
                  {weekRow.map((day) => {
                    const isSelected = day.isSelected;
                    const isDragTarget = dragOverDate === day.dateStr;
                    const visibleTasks = day.tasks.slice(0, 2);
                    const remainingChipSlots = Math.max(0, 2 - visibleTasks.length);
                    const visibleRepeats = showFutureRepeats
                      ? day.projectedRepeats.slice(0, remainingChipSlots)
                      : [];
                    const totalCellTasksAndRepeats =
                      day.tasks.length + (showFutureRepeats ? day.projectedRepeats.length : 0);
                    const shownChipsCount = visibleTasks.length + visibleRepeats.length;
                    const extraTaskCount = Math.max(0, totalCellTasksAndRepeats - shownChipsCount);
                    const cellAriaLabel = formatCalendarCellAriaLabel({
                      dateStr: day.dateStr,
                      pendingCount: day.taskCount,
                      completedCount: day.completedCount,
                      exams: day.exams,
                    });

                    return (
                      <div
                        key={day.dateStr}
                        ref={(el) => {
                          if (el) {
                            cellRefs.current.set(day.dateStr, el);
                          } else {
                            cellRefs.current.delete(day.dateStr);
                          }
                        }}
                        role="gridcell"
                        data-date={day.dateStr}
                        tabIndex={day.dateStr === activeTabStopDate ? 0 : -1}
                        aria-label={cellAriaLabel}
                        aria-selected={isSelected}
                        aria-current={day.isToday ? 'date' : undefined}
                        onClick={() => handleSelectDayCell(day.dateStr, day.isCurrentMonth)}
                        onKeyDown={(e) => handleGridCellKeyDown(e, day.dateStr)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (e.dataTransfer) {
                            e.dataTransfer.dropEffect = 'move';
                          }
                          if (dragOverDate !== day.dateStr) {
                            setDragOverDate(day.dateStr);
                          }
                        }}
                        onDragLeave={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                            setDragOverDate((prev) => (prev === day.dateStr ? null : prev));
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOverDate(null);
                          const taskId =
                            e.dataTransfer?.getData('application/x-lifetrack-task-id') ||
                            e.dataTransfer?.getData('text/plain') ||
                            draggedTaskId;
                          setDraggedTaskId(null);
                          if (!taskId) return;
                          const droppedTask = tasks.find((t) => t.id === taskId);
                          if (!droppedTask || droppedTask.dueDate === day.dateStr) return;
                          onUpdateTask?.({ ...droppedTask, dueDate: day.dateStr });
                        }}
                        className={`min-h-[68px] sm:min-h-[80px] min-w-0 w-full overflow-hidden p-1 sm:p-1.5 rounded-xl border flex flex-col justify-between text-left transition-all cursor-pointer relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                          isDragTarget
                            ? 'border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-500/40'
                            : isSelected
                            ? 'border-emerald-600 bg-emerald-50/50 shadow-2xs ring-2 ring-emerald-500/20'
                            : day.isToday
                            ? 'border-emerald-300 bg-emerald-50/20'
                            : day.isCurrentMonth
                            ? 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50'
                            : 'border-slate-100 bg-slate-50/60 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-0.5 min-w-0 w-full">
                          <span
                            className={`text-[11px] sm:text-xs font-semibold w-[18px] h-[18px] sm:w-6 sm:h-6 shrink-0 flex items-center justify-center rounded-full font-mono tabular-nums ${
                              day.isToday
                                ? 'bg-emerald-600 text-white font-bold'
                                : isSelected
                                ? 'bg-slate-900 text-white'
                                : day.isCurrentMonth
                                ? 'text-slate-800'
                                : 'text-slate-400'
                            }`}
                          >
                            {day.dayNumber}
                          </span>

                          <div className="flex items-center gap-0.5 shrink-0">
                            {day.hasOverduePast && (
                              <span
                                data-testid="calendar-overdue-dot"
                                className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-rose-500 shrink-0"
                                title="Overdue pending tasks"
                              />
                            )}
                            {day.hasExam && (
                              <span
                                data-testid="calendar-mobile-exam-dot"
                                className="sm:hidden w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0"
                                title={`Exam: ${day.examTitle || 'Scheduled'}`}
                              />
                            )}
                          </div>
                        </div>

                        {/* Mobile (< 640px): up to 3 small coloured priority dots, zero text */}
                        <div
                          data-testid="calendar-mobile-dots"
                          className="flex sm:hidden items-center justify-center gap-1 mt-1 min-w-0 w-full overflow-hidden"
                        >
                          {day.priorityDots.map((dot) => (
                            <span
                              key={dot.priority}
                              data-testid="calendar-priority-dot"
                              data-priority={dot.priority}
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT_CLASSES[dot.priority]} ${
                                dot.allDone ? 'opacity-40' : ''
                              }`}
                            />
                          ))}
                        </div>

                        {/* sm+ screens: exam chip before up to 2 truncated task chips + "+N more" */}
                        <div
                          data-testid="calendar-desktop-chips"
                          className="hidden sm:flex flex-col gap-1 mt-1 min-w-0 w-full overflow-hidden"
                        >
                          {day.hasExam && (
                            <div
                              data-testid="calendar-exam-chip"
                              title={day.exams.map((e) => e.subject).join(', ')}
                              className="w-full min-w-0 rounded px-1.5 py-0.5 text-[10px] leading-tight font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200/80 border-l-2 border-l-indigo-600 truncate"
                            >
                              {day.exams.length > 1
                                ? `${day.exams[0].subject} (+${day.exams.length - 1})`
                                : day.exams[0].subject}
                            </div>
                          )}

                          {visibleTasks.map((task) => (
                            <button
                              key={task.id}
                              type="button"
                              draggable
                              data-testid="calendar-task-chip"
                              data-task-id={task.id}
                              data-priority={task.priority}
                              data-completed={task.completed ? 'true' : 'false'}
                              title={task.title}
                              aria-label={`${task.title}, press M to move date`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectDayCell(day.dateStr, day.isCurrentMonth);
                              }}
                              onDragStart={(e) => {
                                e.stopPropagation();
                                if (e.dataTransfer) {
                                  e.dataTransfer.setData('application/x-lifetrack-task-id', task.id);
                                  e.dataTransfer.setData('text/plain', task.id);
                                  e.dataTransfer.effectAllowed = 'move';
                                }
                                setDraggedTaskId(task.id);
                              }}
                              onDragEnd={() => {
                                setDraggedTaskId(null);
                                setDragOverDate(null);
                              }}
                              onKeyDown={(e) => {
                                if (
                                  e.key.toLowerCase() === 'm' &&
                                  !e.ctrlKey &&
                                  !e.metaKey &&
                                  !e.altKey
                                ) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  e.nativeEvent.stopPropagation();
                                  setMoveTaskState({
                                    task,
                                    date: task.dueDate || day.dateStr,
                                  });
                                }
                              }}
                              className={`w-full min-w-0 text-left rounded px-1.5 py-0.5 text-[10px] leading-tight font-medium border border-slate-200/60 border-l-2 truncate cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                                TASK_CHIP_PRIORITY_CLASSES[task.priority]
                              } ${task.completed ? 'line-through opacity-50' : ''} ${
                                draggedTaskId === task.id ? 'opacity-40' : ''
                              }`}
                            >
                              {task.title}
                            </button>
                          ))}

                          {visibleRepeats.map((rep) => (
                            <div
                              key={rep.id}
                              data-testid="calendar-repeat-chip"
                              data-source-task-id={rep.sourceTaskId}
                              aria-disabled="true"
                              title={`${rep.title} (repeats)`}
                              className={`w-full min-w-0 rounded px-1.5 py-0.5 text-[10px] leading-tight font-medium border border-dashed border-slate-300 border-l-2 opacity-55 select-none pointer-events-none flex items-center justify-between gap-1 ${
                                TASK_CHIP_PRIORITY_CLASSES[rep.priority]
                              }`}
                            >
                              <span className="truncate">{rep.title}</span>
                              <span className="shrink-0 text-[9px] uppercase tracking-tight font-semibold text-slate-500">
                                repeats
                              </span>
                            </div>
                          ))}

                          {extraTaskCount > 0 && (
                            <div
                              data-testid="calendar-more-tasks"
                              className="w-full min-w-0 px-1 text-[10px] leading-tight font-semibold text-slate-500 truncate"
                            >
                              +{extraTaskCount} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Selected Day Agenda (5 cols) */}
          <div className="lg:col-span-5 min-w-0 overflow-hidden bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                Selected Day
              </span>
              <h2 className="text-base font-bold text-slate-900 mt-0.5">{selectedFormatted}</h2>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {selectedDateTasks.length} task{selectedDateTasks.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Exams on this day */}
          {selectedDateExams.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-indigo-700 flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Exams Scheduled</span>
              </span>
              {selectedDateExams.map((exam) => (
                <button
                  key={exam.id}
                  type="button"
                  data-testid="calendar-selected-exam-card"
                  onClick={() => onNavigateTab?.('academics')}
                  className="w-full text-left p-3 rounded-xl bg-indigo-50 hover:bg-indigo-100/70 border border-indigo-200/80 text-indigo-950 flex items-start justify-between gap-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                >
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold truncate">{exam.subject}</h3>
                    <p className="text-xs text-indigo-700 mt-0.5 truncate">
                      {exam.courseCode || 'Exam'}
                      {exam.examTime ? ` • ${formatAppTime(exam.examTime, timeFormat)}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                    Exam
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Tasks on this day */}
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-2">Tasks Due / Scheduled</span>
            {selectedDateTasks.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Clock className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                <p className="text-xs text-slate-500">No tasks due on this date.</p>
                <button
                  type="button"
                  onClick={() => onOpenAddTaskModal({ dueDate: selectedDate })}
                  className="mt-2 text-xs font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                >
                  + Add task for this day
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedDateTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={onToggleTask}
                    onClick={onSelectTask}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Keyboard "m" Move Task Date Picker Dialog */}
      {moveTaskState && (
        <div
          id="calendar-move-task-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="calendar-move-task-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs"
          onClick={() => setMoveTaskState(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setMoveTaskState(null);
            }
          }}
        >
          <div
            ref={moveDialogRef}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-sm p-5 space-y-4"
          >
            <div>
              <h2 id="calendar-move-task-title" className="text-sm font-bold text-slate-900">
                Move Task Date
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {moveTaskState.task.title}
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!moveTaskState.date) return;
                onUpdateTask?.({
                  ...moveTaskState.task,
                  dueDate: moveTaskState.date,
                });
                setSelectedDate(moveTaskState.date);
                const targetMonthDate = parseLocalDate(moveTaskState.date);
                setViewMonth(new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth(), 1));
                setMoveTaskState(null);
              }}
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="calendar-move-date-input"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  New due date
                </label>
                <input
                  ref={moveDateInputRef}
                  id="calendar-move-date-input"
                  type="date"
                  required
                  value={moveTaskState.date}
                  onChange={(e) =>
                    setMoveTaskState((prev) => (prev ? { ...prev, date: e.target.value } : null))
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setMoveTaskState(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  id="calendar-move-date-confirm"
                  variant="primary"
                  size="sm"
                >
                  Move Task
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
