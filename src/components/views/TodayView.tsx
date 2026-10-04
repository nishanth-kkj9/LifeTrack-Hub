import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Timer,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  AlertCircle,
  GraduationCap,
  Flame,
  ArrowRight,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { Task, ExamReminder, Habit, Transaction, BudgetSettings, VtuProfile } from '../../types/index.ts';
import { QuickAddBar } from '../todo/QuickAddBar.tsx';
import { TaskRow } from '../ui/TaskRow.tsx';
import { TimelineItem } from '../ui/TimelineItem.tsx';
import { Button } from '../ui/Button.tsx';
import { EmptyState } from '../ui/EmptyState.tsx';
import { getLocalDateString } from '../../lib/dateUtils.ts';

interface TodayViewProps {
  tasks: Task[];
  habits: Habit[];
  exams: ExamReminder[];
  transactions?: Transaction[];
  budget?: BudgetSettings;
  vtuProfile?: VtuProfile;
  onToggleTask: (taskId: string) => void;
  onToggleHabitToday: (habitId: string) => void;
  onAddTask: (task: Task) => void;
  onOpenAddTaskModal: () => void;
  onOpenCommandPalette: () => void;
  onOpenFocusModal: (task?: Task | null) => void;
  onNavigateTab: (tab: any) => void;
  onSelectTask?: (task: Task) => void;
}

export const TodayView: React.FC<TodayViewProps> = ({
  tasks,
  habits,
  exams,
  onToggleTask,
  onToggleHabitToday,
  onAddTask,
  onOpenAddTaskModal,
  onOpenCommandPalette,
  onOpenFocusModal,
  onNavigateTab,
  onSelectTask,
}) => {
  const [taskFilter, setTaskFilter] = useState<'remaining' | 'all' | 'completed'>('remaining');

  // Time-boundary dynamic clock (refreshes every 30s without heavy 1s global timer)
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const currentHour = now.getHours();
  const todayStr = getLocalDateString(now);

  // Dynamic greeting based on user's local time
  const greeting = useMemo(() => {
    if (currentHour >= 5 && currentHour < 12) return 'Good morning';
    if (currentHour >= 12 && currentHour < 17) return 'Good afternoon';
    return 'Good evening';
  }, [currentHour]);

  // Formatted date using local clock
  const formattedDate = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(now);
  }, [now]);

  // Today's prioritized tasks following the canonical documented hierarchy:
  // 1. Overdue
  // 2. Urgent
  // 3. Due Today
  // 4. Starred / Important
  // 5. Other Remaining
  // 6. Completed Today
  const { overdueTasks, urgentTasks, dueTodayTasks, starredTasks, completedTodayTasks, allRemainingToday } = useMemo(() => {
    const overdue: Task[] = [];
    const urgent: Task[] = [];
    const dueToday: Task[] = [];
    const starred: Task[] = [];
    const other: Task[] = [];
    const completedToday: Task[] = [];

    tasks.forEach((task) => {
      if (task.completed) {
        const completedDateStr = task.completedAt ? getLocalDateString(new Date(task.completedAt)) : null;
        if (task.dueDate === todayStr || completedDateStr === todayStr) {
          completedToday.push(task);
        }
      } else {
        const isOverdue = task.dueDate && task.dueDate < todayStr;
        const isUrgent = task.priority === 'urgent';
        const isDueToday = task.dueDate === todayStr;

        if (isOverdue) {
          overdue.push(task);
        } else if (isUrgent) {
          urgent.push(task);
        } else if (isDueToday) {
          dueToday.push(task);
        } else if (task.isStarred) {
          starred.push(task);
        } else {
          other.push(task);
        }
      }
    });

    // Sort helper: Starred first, then priority, then due time
    const priorityWeight: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
    const sortFn = (a: Task, b: Task) => {
      if (a.isStarred && !b.isStarred) return -1;
      if (!a.isStarred && b.isStarred) return 1;
      const pDiff = (priorityWeight[b.priority] || 2) - (priorityWeight[a.priority] || 2);
      if (pDiff !== 0) return pDiff;
      if (a.dueTime && b.dueTime) return a.dueTime.localeCompare(b.dueTime);
      return 0;
    };

    overdue.sort(sortFn);
    urgent.sort(sortFn);
    dueToday.sort(sortFn);
    starred.sort(sortFn);
    other.sort(sortFn);

    // Canonical ordering: Overdue -> Urgent -> Due Today -> Starred/Important -> Other
    const remaining = [...overdue, ...urgent, ...dueToday, ...starred, ...other];

    return {
      overdueTasks: overdue,
      urgentTasks: urgent,
      dueTodayTasks: dueToday,
      starredTasks: starred,
      completedTodayTasks: completedToday,
      allRemainingToday: remaining,
    };
  }, [tasks, todayStr]);

  // Filtered task list
  const displayTasks = useMemo(() => {
    if (taskFilter === 'remaining') return allRemainingToday;
    if (taskFilter === 'completed') return completedTodayTasks;
    return [...allRemainingToday, ...completedTodayTasks];
  }, [taskFilter, allRemainingToday, completedTodayTasks]);

  // Today's timeline items (tasks with time, exams today)
  const timelineItems = useMemo(() => {
    const items: Array<{
      time: string;
      title: string;
      subtitle?: string;
      type: 'task' | 'exam' | 'habit' | 'focus';
      isPast?: boolean;
      taskRef?: Task;
    }> = [];

    // Add tasks with dueTime
    tasks.forEach((t) => {
      if (t.dueDate === todayStr && t.dueTime) {
        const [h, m] = t.dueTime.split(':').map(Number);
        const isPast = currentHour > h || (currentHour === h && now.getMinutes() > (m || 0));
        items.push({
          time: t.dueTime,
          title: t.title,
          subtitle: `${t.category} • ${t.estimatedMinutes ? `${t.estimatedMinutes}m` : 'Scheduled'}`,
          type: 'task',
          isPast,
          taskRef: t,
        });
      }
    });

    // Add exams today
    exams.forEach((ex) => {
      if (ex.examDate === todayStr) {
        items.push({
          time: ex.examTime || '09:00',
          title: `Exam: ${ex.subject}`,
          subtitle: `${ex.courseCode || 'General Exam'} (Today)`,
          type: 'exam',
          isPast: false,
        });
      }
    });

    items.sort((a, b) => a.time.localeCompare(b.time));
    return items;
  }, [tasks, exams, todayStr, currentHour, now]);

  // Next upcoming exam (within 14 days)
  const nextExam = useMemo(() => {
    const upcoming = exams
      .filter((e) => {
        const diffDays = Math.ceil((new Date(e.examDate).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 14;
      })
      .sort((a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime());

    return upcoming[0] || null;
  }, [exams, todayStr]);

  const examDaysLeft = useMemo(() => {
    if (!nextExam) return null;
    const diff = Math.ceil((new Date(nextExam.examDate).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  }, [nextExam, todayStr]);

  // Habit metrics using canonical completedDates
  const habitsDoneTodayCount = useMemo(() => {
    return habits.filter(
      (h) => h.completedDates && h.completedDates.includes(todayStr)
    ).length;
  }, [habits, todayStr]);

  // Overall day completion rate
  const totalItemsToday = allRemainingToday.length + completedTodayTasks.length + habits.length;
  const completedItemsToday = completedTodayTasks.length + habitsDoneTodayCount;
  const dayProgressPercent = totalItemsToday > 0 ? Math.round((completedItemsToday / totalItemsToday) * 100) : 0;

  return (
    <div id="today-view" className="space-y-6 pb-12 animate-fadeIn">
      {/* 1. Today Header & Primary Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-slate-500 text-xs sm:text-sm font-medium">
            <CalendarIcon className="w-4 h-4 text-emerald-600" />
            <span>{formattedDate}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            {greeting}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {allRemainingToday.length === 0
              ? 'You have cleared your main priority tasks for today.'
              : `You have ${allRemainingToday.length} task${allRemainingToday.length === 1 ? '' : 's'} scheduled for today.`}
          </p>
        </div>

        {/* Primary Action Area */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            id="today-primary-add-button"
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={onOpenAddTaskModal}
            className="shadow-sm"
          >
            Add Task
          </Button>

          <Button
            id="today-search-command-button"
            variant="secondary"
            size="md"
            icon={<Search className="w-4 h-4 text-slate-500" />}
            onClick={onOpenCommandPalette}
            aria-label="Search and command palette"
          >
            <span>Search</span>
            <kbd className="hidden sm:inline ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 bg-slate-100 rounded border border-slate-200">
              ⌘K
            </kbd>
          </Button>

          <Button
            id="today-focus-button"
            variant="ghost"
            size="md"
            icon={<Timer className="w-4 h-4 text-purple-600" />}
            onClick={() => onOpenFocusModal(null)}
            className="text-purple-700 hover:bg-purple-50 hover:text-purple-800"
          >
            Focus
          </Button>
        </div>
      </div>

      {/* 2. Quick Add Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
        <QuickAddBar
          onAddTask={onAddTask}
          onOpenAdvancedModal={onOpenAddTaskModal}
          defaultCategory="study"
        />
      </div>

      {/* Two Column Layout: Main Tasks & Day Timeline/Habits */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Today's Tasks (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overdue Alert Banner if any */}
          {overdueTasks.length > 0 && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold">
                  {overdueTasks.length} Overdue Task{overdueTasks.length === 1 ? '' : 's'}
                </h2>
                <p className="text-xs text-amber-750 mt-0.5">
                  Tasks from previous days that require attention. Consider completing or rescheduling them.
                </p>
              </div>
            </div>
          )}

          {/* Today's Tasks Section */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Today's Focus Tasks</h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {allRemainingToday.length}
                </span>
              </div>

              {/* Task filter toggles */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setTaskFilter('remaining')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    taskFilter === 'remaining'
                      ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Remaining ({allRemainingToday.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTaskFilter('all')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    taskFilter === 'all'
                      ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({allRemainingToday.length + completedTodayTasks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTaskFilter('completed')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    taskFilter === 'completed'
                      ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Done ({completedTodayTasks.length})
                </button>
              </div>
            </div>

            {/* Tasks List */}
            {displayTasks.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="w-8 h-8 text-emerald-500" />}
                title={
                  taskFilter === 'completed'
                    ? 'No completed tasks yet'
                    : 'All clear for today!'
                }
                description={
                  taskFilter === 'completed'
                    ? 'Check off tasks above as you finish them.'
                    : 'You have no pending tasks scheduled for today. Enjoy your time or plan ahead.'
                }
                action={
                  taskFilter === 'remaining' ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Plus className="w-3.5 h-3.5" />}
                      onClick={onOpenAddTaskModal}
                    >
                      Add a task
                    </Button>
                  ) : undefined
                }
                className="py-10"
              />
            ) : (
              <div className="space-y-2">
                {displayTasks.map((task) => (
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

          {/* 5. Upcoming Exam Callout Banner (if within 14 days) */}
          {nextExam && (
            <div className="bg-linear-to-r from-indigo-50 to-blue-50 border border-indigo-200/80 rounded-2xl p-5 shadow-xs">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-xs shrink-0 mt-0.5">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-indigo-700 font-semibold">
                      <span>
                        {examDaysLeft === 0
                          ? 'Today!'
                          : examDaysLeft === 1
                          ? 'Tomorrow'
                          : `In ${examDaysLeft} days`}
                      </span>
                      {nextExam.courseCode && (
                        <>
                          <span aria-hidden="true" className="text-indigo-400">·</span>
                          <span className="font-mono text-slate-600">
                            {nextExam.courseCode}
                          </span>
                        </>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mt-1">
                      {nextExam.subject}
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Exam Date: {nextExam.examDate} {nextExam.examTime ? `at ${nextExam.examTime}` : ''}
                    </p>
                  </div>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  icon={<BookOpen className="w-3.5 h-3.5" />}
                  onClick={() => onNavigateTab('academics')}
                  className="bg-white hover:bg-slate-50 border-indigo-200 text-indigo-900 shrink-0"
                >
                  Study Guide
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Timeline, Habits & Day Summary (1 col) */}
        <div className="space-y-6">
          {/* 3. Timeline / Scheduled Items */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-bold text-slate-900">Today's Timeline</h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('calendar')}
                className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
              >
                <span>Calendar</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {timelineItems.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                No specific time-blocked items for today. Add a due time to tasks to schedule them.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {timelineItems.map((item, idx) => (
                  <TimelineItem
                    key={idx}
                    time={item.time}
                    title={item.title}
                    subtitle={item.subtitle}
                    type={item.type}
                    isPast={item.isPast}
                    onClick={() => {
                      if (item.taskRef && onSelectTask) onSelectTask(item.taskRef);
                      else if (item.type === 'exam') onNavigateTab('academics');
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 6. Today's Habits */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-bold text-slate-900">Today's Habits</h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('habits')}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
              >
                <span>View all</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {habits.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">
                No habits configured yet. Create daily habits to build consistency.
              </p>
            ) : (
              <div className="space-y-2">
                {habits.map((habit) => {
                  const habitTitle = habit.name;
                  const isDoneToday = Boolean(
                    habit.completedDates && habit.completedDates.includes(todayStr)
                  );

                  return (
                    <div
                      key={habit.id}
                      onClick={() => onToggleHabitToday(habit.id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isDoneToday
                          ? 'bg-amber-50/60 border-amber-200/80 text-amber-950'
                          : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100/70 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          type="button"
                          aria-label={isDoneToday ? `Mark ${habitTitle} incomplete` : `Mark ${habitTitle} completed`}
                          className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                            isDoneToday
                              ? 'bg-amber-500 border-amber-500 text-white'
                              : 'border-slate-300 bg-white hover:border-amber-500'
                          }`}
                        >
                          {isDoneToday && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </button>
                        <span className={`text-xs font-medium truncate ${isDoneToday ? 'line-through text-slate-500' : ''}`}>
                          {habitTitle}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 shrink-0">
                        <Flame className="w-3 h-3 fill-amber-500 text-amber-500" />
                        <span>{habit.streak || 0}d</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 7. Small Progress Summary */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-4">
            <div className="flex items-center justify-between text-xs font-medium text-slate-700 mb-2">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Day Progress</span>
              </span>
              <span className="font-bold text-slate-900">{dayProgressPercent}%</span>
            </div>

            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, dayProgressPercent)}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-200/60 text-center">
              <div>
                <span className="block text-[11px] text-slate-500">Tasks Completed</span>
                <span className="text-xs font-bold text-slate-800">
                  {completedTodayTasks.length} / {allRemainingToday.length + completedTodayTasks.length}
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-500">Habits Kept</span>
                <span className="text-xs font-bold text-slate-800">
                  {habitsDoneTodayCount} / {habits.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
