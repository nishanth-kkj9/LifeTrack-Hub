import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  Tag,
  Sparkles,
} from 'lucide-react';
import { Task, ExamReminder } from '../../types/index.ts';
import { Button } from '../ui/Button.tsx';
import { TaskRow } from '../ui/TaskRow.tsx';
import { getLocalDateString, formatAppTime, parseLocalDate } from '../../lib/dateUtils.ts';

interface CalendarViewProps {
  tasks: Task[];
  exams: ExamReminder[];
  onToggleTask: (taskId: string) => void;
  onSelectTask?: (task: Task) => void;
  onOpenAddTaskModal: () => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  tasks,
  exams,
  onToggleTask,
  onSelectTask,
  onOpenAddTaskModal,
}) => {
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString());
  const [viewMonth, setViewMonth] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<'month' | 'agenda'>('month');

  // Navigate months
  const handlePrevMonth = () => {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));
  };
  const handleToday = () => {
    const today = new Date();
    setViewMonth(today);
    setSelectedDate(getLocalDateString(today));
  };

  // Calendar month grid calculation
  const calendarDays = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      taskCount: number;
      completedCount: number;
      hasExam: boolean;
      examTitle?: string;
    }> = [];

    const todayStr = getLocalDateString();

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, d);
      const dateStr = getLocalDateString(prevDate);
      const count = tasks.filter((t) => t.dueDate === dateStr && !t.completed).length;
      const completedCount = tasks.filter((t) => t.dueDate === dateStr && t.completed).length;
      const exam = exams.find((e) => e.examDate === dateStr);
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        taskCount: count,
        completedCount,
        hasExam: Boolean(exam),
        examTitle: exam?.subject,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const currDate = new Date(year, month, d);
      const dateStr = getLocalDateString(currDate);
      const count = tasks.filter((t) => t.dueDate === dateStr && !t.completed).length;
      const completedCount = tasks.filter((t) => t.dueDate === dateStr && t.completed).length;
      const exam = exams.find((e) => e.examDate === dateStr);
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        taskCount: count,
        completedCount,
        hasExam: Boolean(exam),
        examTitle: exam?.subject,
      });
    }

    // Next month padding to complete 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      const dateStr = getLocalDateString(nextDate);
      const count = tasks.filter((t) => t.dueDate === dateStr && !t.completed).length;
      const completedCount = tasks.filter((t) => t.dueDate === dateStr && t.completed).length;
      const exam = exams.find((e) => e.examDate === dateStr);
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        taskCount: count,
        completedCount,
        hasExam: Boolean(exam),
        examTitle: exam?.subject,
      });
    }

    return days;
  }, [viewMonth, selectedDate, tasks, exams]);

  // Tasks on selected date
  const selectedDateTasks = useMemo(() => {
    return tasks.filter((t) => t.dueDate === selectedDate);
  }, [tasks, selectedDate]);

  // Exams on selected date
  const selectedDateExams = useMemo(() => {
    return exams.filter((e) => e.examDate === selectedDate);
  }, [exams, selectedDate]);

  // Upcoming 7-day scheduled events list for Agenda mode
  const upcomingEvents = useMemo(() => {
    const today = getLocalDateString();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const maxDateStr = getLocalDateString(futureDate);

    const upcomingTasks = tasks
      .filter((t) => t.dueDate && t.dueDate >= today && t.dueDate <= maxDateStr && !t.completed)
      .map((t) => ({
        id: t.id,
        date: t.dueDate!,
        time: t.dueTime,
        title: t.title,
        type: 'task' as const,
        priority: t.priority,
        category: t.category,
        taskRef: t,
      }));

    const upcomingExams = exams
      .filter((e) => e.examDate >= today && e.examDate <= maxDateStr)
      .map((e) => ({
        id: e.id,
        date: e.examDate,
        time: e.examTime,
        title: `Exam: ${e.subject}`,
        type: 'exam' as const,
        priority: 'urgent' as const,
        category: 'academic',
        courseCode: e.courseCode,
      }));

    return [...upcomingTasks, ...upcomingExams].sort((a, b) => {
      const dDiff = a.date.localeCompare(b.date);
      if (dDiff !== 0) return dDiff;
      return (a.time || '23:59').localeCompare(b.time || '23:59');
    });
  }, [tasks, exams]);

  // Month stats
  const monthStats = useMemo(() => {
    const currMonthDays = calendarDays.filter((d) => d.isCurrentMonth);
    const totalPending = currMonthDays.reduce((acc, d) => acc + d.taskCount, 0);
    const totalDone = currMonthDays.reduce((acc, d) => acc + d.completedCount, 0);
    const totalExams = currMonthDays.filter((d) => d.hasExam).length;
    return { totalPending, totalDone, totalExams };
  }, [calendarDays]);

  const monthName = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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
            Plan deadlines, scheduled study time blocks, and academic exam dates.
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
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold px-3 min-w-[120px] text-center text-slate-800">
              {monthName}
            </span>
            <button
              type="button"
              id="calendar-next-month-btn"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={onOpenAddTaskModal}
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-xs"
          >
            Add Task
          </Button>
        </div>
      </div>

      {/* Month Metrics Overview Strip */}
      <div className="grid grid-cols-3 gap-3.5">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="text-xs font-medium text-slate-500">Scheduled Deadlines</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {monthStats.totalPending}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Due in {monthName.split(' ')[0]}</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="text-xs font-medium text-slate-500">Exams Scheduled</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-indigo-600 mt-1">
            {monthStats.totalExams}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">University & Class tests</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="text-xs font-medium text-slate-500">Completed in Month</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 mt-1">
            {monthStats.totalDone}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Tasks checked off</div>
        </div>
      </div>

      {/* View Mode: Month vs Agenda */}
      {viewMode === 'agenda' ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Upcoming 30-Day Agenda</h2>
              <p className="text-xs text-slate-500 mt-0.5">Chronological timeline of all scheduled tasks and university exam dates.</p>
            </div>
            <span className="text-xs font-bold font-mono tabular-nums text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
              {upcomingEvents.length} Events
            </span>
          </div>

          {upcomingEvents.length === 0 ? (
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
                onClick={onOpenAddTaskModal}
                className="mt-4"
              >
                Schedule a Task
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {upcomingEvents.map((evt) => {
                const dateDisplay = parseLocalDate(evt.date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                });
                const isExam = evt.type === 'exam';

                return (
                  <div
                    key={`${evt.type}-${evt.id}`}
                    onClick={() => {
                      if (evt.type === 'task' && evt.taskRef && onSelectTask) {
                        onSelectTask(evt.taskRef);
                      }
                      setSelectedDate(evt.date);
                    }}
                    className={`py-3.5 px-3 rounded-xl transition-colors flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 ${
                      evt.date === selectedDate ? 'bg-slate-50/80 ring-1 ring-slate-200' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="text-center w-14 shrink-0 font-mono text-xs">
                        <span className="block font-bold text-slate-900">{evt.date.split('-')[2]}</span>
                        <span className="block text-[10px] text-slate-500 uppercase">{dateDisplay.split(' ')[1]}</span>
                      </div>
                      <div className="h-8 w-px bg-slate-200" aria-hidden="true" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold ${isExam ? 'text-indigo-700' : 'text-slate-900'} truncate`}>
                            {evt.title}
                          </span>
                          {isExam && (
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.5 rounded">
                              Exam
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          <span>{dateDisplay}</span>
                          {evt.time && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{formatAppTime(evt.time)}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="capitalize">{evt.category}</span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {isExam ? (
                        <GraduationCap className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleTask(evt.id);
                          }}
                          className="w-5 h-5 rounded-md border border-slate-300 hover:border-emerald-600 bg-white flex items-center justify-center transition-colors cursor-pointer"
                          aria-label={`Complete ${evt.title}`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-slate-300 hover:text-emerald-600" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Grid: 2 cols - Left is Calendar Month, Right is Day Agenda */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Month View Card (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
            {/* Day of Week Headers */}
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="text-xs font-semibold text-slate-400 py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1.5">
              {calendarDays.map((day) => {
                const isSelected = day.isSelected;

                return (
                  <button
                    key={day.dateStr}
                    type="button"
                    aria-label={`${day.dateStr}, ${day.taskCount} tasks${day.hasExam ? ', exam scheduled' : ''}`}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedDate(day.dateStr)}
                    className={`min-h-[68px] sm:min-h-[80px] p-2 rounded-xl border flex flex-col justify-between text-left transition-all cursor-pointer relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-2xs ring-2 ring-emerald-500/20'
                        : day.isToday
                        ? 'border-emerald-300 bg-emerald-50/20'
                        : day.isCurrentMonth
                        ? 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50'
                        : 'border-slate-100 bg-slate-50/60 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full font-mono tabular-nums ${
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

                      {day.hasExam && (
                        <span
                          className="w-2.5 h-2.5 rounded-full bg-indigo-600 ring-2 ring-indigo-200"
                          title={`Exam: ${day.examTitle || 'Scheduled'}`}
                        />
                      )}
                    </div>

                    {/* Task count indicators */}
                    <div className="mt-1 flex items-center gap-1 flex-wrap">
                      {day.taskCount > 0 && (
                        <span className="text-[10px] font-mono tabular-nums font-semibold px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-700">
                          {day.taskCount} {day.taskCount === 1 ? 'task' : 'tasks'}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Day Agenda (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
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
                <div
                  key={exam.id}
                  className="p-3 rounded-xl bg-indigo-50 border border-indigo-200/80 text-indigo-950 flex items-start justify-between"
                >
                  <div>
                    <h3 className="text-sm font-bold">{exam.subject}</h3>
                    <p className="text-xs text-indigo-700 mt-0.5">
                      {exam.courseCode || 'Exam'} • {exam.examTime ? formatAppTime(exam.examTime) : 'Morning session'}
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                    Exam
                  </span>
                </div>
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
                  onClick={onOpenAddTaskModal}
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
    </div>
  );
};
