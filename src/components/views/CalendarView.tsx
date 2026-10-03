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
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [viewMonth, setViewMonth] = useState(() => new Date());

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
    setSelectedDate(today.toISOString().split('T')[0]);
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
      hasExam: boolean;
    }> = [];

    const todayStr = new Date().toISOString().split('T')[0];

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, d);
      const dateStr = prevDate.toISOString().split('T')[0];
      const count = tasks.filter((t) => t.dueDate === dateStr && !t.completed).length;
      const hasExam = exams.some((e) => e.examDate === dateStr);
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        taskCount: count,
        hasExam,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const currDate = new Date(year, month, d);
      const dateStr = currDate.toISOString().split('T')[0];
      const count = tasks.filter((t) => t.dueDate === dateStr && !t.completed).length;
      const hasExam = exams.some((e) => e.examDate === dateStr);
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        taskCount: count,
        hasExam,
      });
    }

    // Next month padding to complete 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      const dateStr = nextDate.toISOString().split('T')[0];
      const count = tasks.filter((t) => t.dueDate === dateStr && !t.completed).length;
      const hasExam = exams.some((e) => e.examDate === dateStr);
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        taskCount: count,
        hasExam,
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

  const monthName = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const selectedFormatted = new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div id="calendar-view" className="space-y-6 animate-fadeIn pb-12">
      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-emerald-600" />
            <span>Calendar & Schedule</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Plan your deadlines, scheduled time blocks, and academic exam dates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleToday}>
            Today
          </Button>
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-md hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold px-2 min-w-[110px] text-center text-slate-800">
              {monthName}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-md hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
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
          >
            Add Task
          </Button>
        </div>
      </div>

      {/* Grid: 2 cols - Left is Calendar Month, Right is Day Agenda */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Month View Card (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
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
                  onClick={() => setSelectedDate(day.dateStr)}
                  className={`min-h-[64px] sm:min-h-[76px] p-1.5 rounded-xl border flex flex-col justify-between text-left transition-all cursor-pointer relative ${
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
                      className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                        day.isToday
                          ? 'bg-emerald-600 text-white'
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
                      <span className="w-2 h-2 rounded-full bg-indigo-600" title="Exam scheduled" />
                    )}
                  </div>

                  {/* Badges / dots */}
                  <div className="mt-1 flex items-center gap-1 flex-wrap">
                    {day.taskCount > 0 && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-700">
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
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
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
                    <h3 className="text-sm font-bold">{exam.title}</h3>
                    <p className="text-xs text-indigo-700 mt-0.5">
                      {exam.subjectCode} • {exam.examTime || 'Morning session'}
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
    </div>
  );
};
