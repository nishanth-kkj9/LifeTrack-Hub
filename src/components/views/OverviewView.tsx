import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  DollarSign,
  GraduationCap,
  Flame,
  Plus,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Calendar,
  Award,
} from 'lucide-react';
import { Task, Transaction, ExamReminder, Habit, BudgetSettings, VtuProfile } from '../../types/index.ts';
import { calculateCumulativeCgpa, calculateAttendanceReport, calculateSemesterSgpa } from '../../lib/vtuData.ts';
import { ActiveTab } from '../Navigation.tsx';

interface OverviewViewProps {
  tasks: Task[];
  transactions: Transaction[];
  budget: BudgetSettings;
  exams: ExamReminder[];
  habits: Habit[];
  vtuProfile?: VtuProfile;
  onNavigateTab: (tab: ActiveTab) => void;
  onToggleTask: (taskId: string) => void;
  onToggleHabitToday: (habitId: string) => void;
  onOpenAddTaskModal: () => void;
  onOpenAddTransactionModal: () => void;
  onOpenAddExamModal: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  tasks,
  transactions,
  budget,
  exams,
  habits,
  vtuProfile,
  onNavigateTab,
  onToggleTask,
  onToggleHabitToday,
  onOpenAddTaskModal,
  onOpenAddTransactionModal,
  onOpenAddExamModal,
}) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute Task stats
  const activeTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);
  const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  // Urgent and today tasks
  const todayStr = new Date().toISOString().split('T')[0];
  const urgentTasks = activeTasks.filter(
    (t) => t.priority === 'urgent' || t.dueDate === todayStr || t.dueDate < todayStr
  );

  // Compute Financial stats
  const totalIncome = transactions
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const totalExpense = transactions
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const netBalance = totalIncome - totalExpense;
  const budgetPercentage = budget.monthlyBudget > 0 ? Math.min(Math.round((totalExpense / budget.monthlyBudget) * 100), 100) : 0;

  // Upcoming Exams sorted by date
  const sortedExams = [...exams]
    .filter((e) => new Date(`${e.examDate}T${e.examTime || '23:59'}`).getTime() > now)
    .sort((a, b) => {
      const timeA = new Date(`${a.examDate}T${a.examTime || '09:00'}`).getTime();
      const timeB = new Date(`${b.examDate}T${b.examTime || '09:00'}`).getTime();
      return timeA - timeB;
    });

  const nextExam = sortedExams[0];

  // Helper for live countdown
  const getExamCountdown = (exam: ExamReminder) => {
    const examTime = new Date(`${exam.examDate}T${exam.examTime || '09:00'}`).getTime();
    const diff = examTime - now;
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, passed: true };
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);
    return { days, hours, minutes, seconds, passed: false };
  };

  // Habits completed today
  const habitsCompletedToday = habits.filter((h) => h.completedDates.includes(todayStr));
  const habitCompletionPercent = habits.length > 0 ? Math.round((habitsCompletedToday.length / habits.length) * 100) : 0;

  return (
    <div id="overview-dashboard-container" className="space-y-6 pb-12">
      {/* Welcome & Quick Action Bar */}
      <div id="overview-hero-bar" className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Your Daily Command Center</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time synchronization across your assignments, budget cashflow, and exam countdowns.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="overview-quick-add-task-btn"
            onClick={onOpenAddTaskModal}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Task</span>
          </button>
          <button
            id="overview-quick-add-expense-btn"
            onClick={onOpenAddTransactionModal}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            <span>Log Money</span>
          </button>
          <button
            id="overview-quick-add-exam-btn"
            onClick={onOpenAddExamModal}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
          >
            <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
            <span>Add Exam</span>
          </button>
          <button
            id="overview-open-vtu-hub-btn"
            onClick={() => onNavigateTab('vtu')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition cursor-pointer shadow-xs"
          >
            <Award className="w-3.5 h-3.5" />
            <span>VTU Student Hub</span>
          </button>
        </div>
      </div>

      {/* VTU Engineering Quick Snapshot Banner */}
      {vtuProfile && (
        <div
          id="overview-vtu-banner"
          onClick={() => onNavigateTab('vtu')}
          className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-xs cursor-pointer hover:border-indigo-500/50 transition group"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-xl bg-indigo-500/20 border border-indigo-400/20 text-indigo-300 group-hover:scale-105 transition-transform">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300">
                    VTU CBCS Tracker
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    USN: {vtuProfile.usn || '1MS22CS084'}
                  </span>
                </div>
                <h3 className="font-bold text-sm text-white mt-0.5">
                  {vtuProfile.branch} • Semester {vtuProfile.currentSemester} ({vtuProfile.scheme} Scheme)
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs shrink-0 bg-slate-800/80 px-4 py-2.5 rounded-xl border border-slate-700">
              {(() => {
                const { cgpa, percentage } = calculateCumulativeCgpa(vtuProfile.semesters);
                const currentSem = vtuProfile.semesters.find(
                  (s) => s.semesterNumber === vtuProfile.currentSemester
                );
                const currentSubjects = currentSem?.subjects || [];
                const totalAttended = currentSubjects.reduce((acc, s) => acc + s.attendedClasses, 0);
                const totalConducted = currentSubjects.reduce((acc, s) => acc + s.totalClasses, 0);
                const attReport = calculateAttendanceReport(totalAttended, totalConducted, 85);

                return (
                  <>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">CGPA</span>
                      <span className="font-extrabold text-white text-sm">{cgpa > 0 ? cgpa.toFixed(2) : '—'}</span>
                      <span className="text-[10px] text-indigo-300 ml-1">({percentage}%)</span>
                    </div>
                    <div className="h-6 w-px bg-slate-700" />
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Attendance</span>
                      <span
                        className={`font-extrabold text-sm ${
                          attReport.status === 'safe'
                            ? 'text-emerald-400'
                            : attReport.status === 'warning'
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {attReport.percentage}%
                      </span>
                    </div>
                    <div className="h-6 w-px bg-slate-700" />
                    <div className="flex items-center gap-1 text-indigo-300 font-bold group-hover:translate-x-0.5 transition-transform">
                      <span>Open Hub</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 4 Core Vital Metric Cards */}
      <div id="overview-metrics-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tasks */}
        <div
          id="metric-card-tasks"
          onClick={() => onNavigateTab('tasks')}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-200 transition cursor-pointer group shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Tasks</span>
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">{activeTasks.length}</span>
            <span className="text-xs font-semibold text-slate-500">
              {completedTasks.length} done today
            </span>
          </div>
          <div className="mt-3">
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${completionRate}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
              <span>Progress</span>
              <span className="font-semibold text-slate-700">{completionRate}%</span>
            </div>
          </div>
        </div>

        {/* Card 2: Finances */}
        <div
          id="metric-card-finances"
          onClick={() => onNavigateTab('finances')}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-emerald-200 transition cursor-pointer group shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Net Balance</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className={`text-2xl font-black ${netBalance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
              ${netBalance.toFixed(2)}
            </span>
            <span className="text-xs font-medium text-emerald-700 flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" />
              +${totalIncome.toFixed(0)}
            </span>
          </div>
          <div className="mt-3">
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  budgetPercentage > 90 ? 'bg-rose-500' : budgetPercentage > 75 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${budgetPercentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
              <span>Budget: ${totalExpense.toFixed(0)} / ${budget.monthlyBudget}</span>
              <span className="font-semibold text-slate-700">{budgetPercentage}%</span>
            </div>
          </div>
        </div>

        {/* Card 3: Next Exam Countdown */}
        <div
          id="metric-card-exams"
          onClick={() => onNavigateTab('exams')}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-amber-200 transition cursor-pointer group shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Next Exam</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600 group-hover:scale-110 transition-transform">
              <GraduationCap className="w-4 h-4" />
            </span>
          </div>
          {nextExam ? (
            <div>
              <p className="font-extrabold text-sm text-slate-900 truncate" title={nextExam.subject}>
                {nextExam.subject}
              </p>
              {(() => {
                const cd = getExamCountdown(nextExam);
                return (
                  <div className="mt-2 flex items-baseline gap-1.5 text-amber-700 font-mono">
                    <span className="text-xl font-black">{cd.days}d</span>
                    <span className="text-lg font-bold">{cd.hours}h</span>
                    <span className="text-xs font-medium text-amber-600">{cd.minutes}m remaining</span>
                  </div>
                );
              })()}
              <p className="text-[11px] text-slate-400 mt-1 truncate">
                {nextExam.courseCode ? `${nextExam.courseCode} • ` : ''}
                {nextExam.examDate} @ {nextExam.examTime}
              </p>
            </div>
          ) : (
            <div className="py-2">
              <p className="text-sm font-semibold text-slate-600">No pending exams</p>
              <p className="text-xs text-slate-400 mt-1">All caught up or time to relax!</p>
            </div>
          )}
        </div>

        {/* Card 4: Daily Habits Streak */}
        <div
          id="metric-card-habits"
          onClick={() => onNavigateTab('habits')}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-orange-200 transition cursor-pointer group shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Daily Habits</span>
            <span className="p-2 rounded-xl bg-orange-50 text-orange-600 group-hover:scale-110 transition-transform">
              <Flame className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">
              {habitsCompletedToday.length}/{habits.length}
            </span>
            <span className="text-xs font-bold text-orange-600 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 fill-orange-500 text-orange-500" />
              Active
            </span>
          </div>
          <div className="mt-3">
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-orange-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${habitCompletionPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
              <span>Today's Consistency</span>
              <span className="font-semibold text-slate-700">{habitCompletionPercent}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Urgent Triage vs Exam & Habit Trackers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Urgent & Today's Tasks */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
                <h2 className="text-base font-bold text-slate-900">Priority Triage & Due Soon</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 font-semibold text-slate-600">
                  {urgentTasks.length}
                </span>
              </div>
              <button
                id="overview-see-all-tasks-link"
                onClick={() => onNavigateTab('tasks')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
              >
                <span>View all tasks</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {urgentTasks.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="text-sm font-semibold text-slate-800">No overdue or urgent tasks!</p>
                <p className="text-xs text-slate-400 mt-1">You are completely on top of your schedule.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {urgentTasks.slice(0, 5).map((task) => (
                  <div
                    key={task.id}
                    id={`overview-task-item-${task.id}`}
                    className="p-3 rounded-xl border border-slate-150 hover:border-slate-300 bg-slate-50/50 flex items-start gap-3 transition"
                  >
                    <button
                      id={`overview-toggle-task-${task.id}`}
                      onClick={() => onToggleTask(task.id)}
                      className="mt-0.5 text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                    >
                      {task.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-50" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs sm:text-sm text-slate-900 truncate">
                          {task.title}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            task.priority === 'urgent'
                              ? 'bg-rose-100 text-rose-700'
                              : task.priority === 'high'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {task.priority}
                        </span>
                      </div>
                      {task.description && (
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{task.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1 text-slate-600 font-medium">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          Due {task.dueDate} {task.dueTime ? `@ ${task.dueTime}` : ''}
                        </span>
                        {task.subtasks.length > 0 && (
                          <span>
                            {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length} subtasks
                          </span>
                        )}
                        <span className="capitalize px-1.5 py-0.2 rounded bg-slate-200/70 text-slate-600">
                          {task.category}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Habits Checkoff Box */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
                <h2 className="text-sm font-bold text-slate-900">Today's Habit Check-in</h2>
              </div>
              <button
                id="overview-see-all-habits-link"
                onClick={() => onNavigateTab('habits')}
                className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
              >
                <span>Track streaks</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {habits.map((habit) => {
                const isDoneToday = habit.completedDates.includes(todayStr);
                return (
                  <div
                    key={habit.id}
                    id={`overview-habit-item-${habit.id}`}
                    onClick={() => onToggleHabitToday(habit.id)}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition select-none ${
                      isDoneToday
                        ? 'bg-orange-50/70 border-orange-200 text-orange-900'
                        : 'bg-slate-50 border-slate-200/80 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${
                          isDoneToday
                            ? 'bg-orange-500 border-orange-500 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isDoneToday && <CheckCircle2 className="w-4 h-4" />}
                      </div>
                      <span className="text-xs font-semibold">{habit.name}</span>
                    </div>
                    <span className="text-xs font-bold text-orange-600 flex items-center gap-0.5">
                      <Flame className="w-3 h-3 fill-orange-500" />
                      {habit.streak}d
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Upcoming Exams Radar & Financial Mini Pulse */}
        <div className="space-y-4">
          {/* Upcoming Exams Radar */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-indigo-600" />
                <h2 className="text-sm font-bold text-slate-900">Exam Countdown Radar</h2>
              </div>
              <button
                id="overview-see-all-exams-link"
                onClick={() => onNavigateTab('exams')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {sortedExams.slice(0, 3).map((exam) => {
                const cd = getExamCountdown(exam);
                const coveredTopics = exam.topics.filter((t) => t.completed).length;
                const topicsRate = exam.topics.length > 0 ? Math.round((coveredTopics / exam.topics.length) * 100) : 0;

                return (
                  <div
                    key={exam.id}
                    id={`overview-exam-card-${exam.id}`}
                    className="p-3.5 rounded-xl border border-slate-150 bg-slate-50/70 hover:border-indigo-200 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-xs text-slate-900">{exam.subject}</p>
                        <p className="text-[11px] text-slate-500">
                          {exam.examDate} @ {exam.examTime}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-mono text-xs font-bold whitespace-nowrap">
                        {cd.days}d {cd.hours}h {cd.minutes}m
                      </span>
                    </div>

                    <div className="mt-2.5">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                        <span>Syllabus covered: {coveredTopics}/{exam.topics.length}</span>
                        <span className="font-semibold text-slate-700">{topicsRate}%</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                          style={{ width: `${topicsRate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Navigation Card */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-sm text-white">Quick Shortcuts</h3>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                Hub
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Access your revision notes, formula cheat-sheets, and daily habit consistency tracking.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                id="overview-quick-link-habits"
                onClick={() => onNavigateTab('habits')}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-left transition cursor-pointer"
              >
                <div className="flex items-center gap-1.5 text-orange-400 text-xs font-bold mb-1">
                  <Flame className="w-3.5 h-3.5" />
                  <span>Habits</span>
                </div>
                <p className="text-[11px] text-slate-400">Log your rituals</p>
              </button>
              <button
                id="overview-quick-link-notes"
                onClick={() => onNavigateTab('notes')}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-left transition cursor-pointer"
              >
                <div className="flex items-center gap-1.5 text-indigo-400 text-xs font-bold mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Scratchpad</span>
                </div>
                <p className="text-[11px] text-slate-400">Formula sheets</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
