import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  CheckCircle2,
  Flame,
  Wallet,
  GraduationCap,
  Sparkles,
  BarChart3,
  Activity,
  Download,
  Upload,
  Database,
  FileSpreadsheet,
} from 'lucide-react';
import { Task, Habit, Transaction, BudgetSettings, ExamReminder, DailyLifeMetric, UserAppData } from '../../types/index.ts';
import { getLocalDateString, parseLocalDate } from '../../lib/dateUtils.ts';
import { isActive } from '../../lib/entity.ts';
import { isOverdue } from '../../lib/taskUtils.ts';
import { analyzeLifeMetricCorrelations } from '../../lib/correlationEngine.ts';
import {
  exportAppDataJson,
  exportHabitsCsv,
  exportTasksCsv,
  exportTransactionsCsv,
  exportDailyMetricsCsv,
  prepareRestore,
  summarizeAppDataCounts,
  type PreparedRestoreResult,
} from '../../lib/dataExport.ts';
import { DailyLifeCheckinModal } from '../insights/DailyLifeCheckinModal.tsx';
import { LifeInsightsPanel } from '../insights/LifeInsightsPanel.tsx';
import { RestoreConfirmDialog } from '../common/RestoreConfirmDialog.tsx';
import { filterMetricsByRange } from '../../lib/analytics.ts';
import { getHabitStats } from '../../lib/habitScoring.ts';
import { formatCurrency } from '../../lib/format.ts';
import {
  monthKey,
  summarizeMonth,
  budgetStatus,
} from '../../lib/financeUtils.ts';

interface InsightsViewProps {
  tasks: Task[];
  habits: Habit[];
  transactions: Transaction[];
  budget: BudgetSettings;
  exams: ExamReminder[];
  dailyMetrics?: DailyLifeMetric[];
  onSaveDailyMetric?: (metric: DailyLifeMetric) => void;
  appData?: UserAppData;
  onRestoreAppData?: (data: UserAppData) => void;
}

export const InsightsView: React.FC<InsightsViewProps> = ({
  tasks,
  habits,
  transactions,
  budget,
  exams,
  dailyMetrics = [],
  onSaveDailyMetric,
  appData,
  onRestoreAppData,
}) => {
  const todayStr = getLocalDateString();
  const [rangeDays, setRangeDays] = useState<7 | 30 | null>(7);
  const [isCheckinOpen, setIsCheckinOpen] = useState(false);
  const [backupStatus, setBackupStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pendingRestore, setPendingRestore] = useState<PreparedRestoreResult | null>(null);

  const effectiveAppData = useMemo<UserAppData>(
    () =>
      appData ?? {
        tasks,
        transactions,
        budget,
        exams,
        habits,
        notes: [],
        dailyMetrics,
      },
    [appData, tasks, transactions, budget, exams, habits, dailyMetrics]
  );
  const currentSummary = useMemo(
    () => summarizeAppDataCounts(effectiveAppData),
    [effectiveAppData]
  );

  const filteredMetrics = useMemo(
    () => filterMetricsByRange(dailyMetrics, rangeDays, todayStr),
    [dailyMetrics, rangeDays, todayStr]
  );

  // Correlations always use at least 30 days (when 7 days is selected, widen to 30 days)
  const correlationMetrics = useMemo(
    () => filterMetricsByRange(dailyMetrics, rangeDays === 7 ? 30 : rangeDays, todayStr),
    [dailyMetrics, rangeDays, todayStr]
  );

  const correlations = useMemo(() => {
    return analyzeLifeMetricCorrelations(correlationMetrics, tasks, habits);
  }, [correlationMetrics, tasks, habits]);

  // 1. Task Metrics
  const taskStats = useMemo(() => {
    const activeTasks = tasks.filter(isActive);
    const total = activeTasks.length;
    const completed = activeTasks.filter((t) => t.completed).length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const now = new Date();
    const rangeStartMs =
      rangeDays === null
        ? null
        : new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - (rangeDays - 1),
            0,
            0,
            0,
            0
          ).getTime();

    const completedInRange = activeTasks.filter((t) => {
      if (!t.completed) return false;
      if (typeof t.completedAt !== 'number' || !Number.isFinite(t.completedAt)) {
        return false;
      }
      if (rangeStartMs === null) return true;
      return t.completedAt >= rangeStartMs;
    }).length;

    const overdueCount = activeTasks.filter((t) => isOverdue(t, now)).length;

    // Categories breakdown
    const categoryCount: Record<string, number> = {};
    activeTasks.forEach((t) => {
      const cat = t.category || 'other';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });

    return { total, completed, rate, completedInRange, overdueCount, categoryCount };
  }, [tasks, rangeDays]);

  // 2. Habit Consistency (computed strictly from completedDates via getHabitStats)
  const habitStats = useMemo(() => {
    if (habits.length === 0) return { avgStreak: 0, bestStreak: 0, checkedInToday: 0 };
    const streaks = habits.map((h) => getHabitStats(h, todayStr).currentStreak);
    const bestStreak = Math.max(...streaks, 0);
    const avgStreak = Math.round(
      streaks.reduce((sum, s) => sum + s, 0) / habits.length
    );
    const checkedInToday = habits.filter(
      (h) => h.completedDates && h.completedDates.includes(todayStr)
    ).length;

    return { avgStreak, bestStreak, checkedInToday };
  }, [habits, todayStr]);

  // 3. Financial Review (shared financeUtils rules, scoped to current month)
  const financeStats = useMemo(() => {
    const currentMonth = monthKey(todayStr);
    const currentMonthSummary = summarizeMonth(transactions, currentMonth, todayStr);
    const rawBudget = budget?.monthlyBudget;
    const monthlyBudget =
      typeof rawBudget === 'number' && Number.isFinite(rawBudget) && rawBudget > 0
        ? rawBudget
        : 0;
    const budgetHealth = budgetStatus(currentMonthSummary.expense, monthlyBudget);
    const overAmount = budgetHealth.over ? Math.abs(budgetHealth.remaining) : 0;

    return {
      monthlyBudget,
      hasBudget: monthlyBudget > 0,
      monthlyIncome: currentMonthSummary.income,
      monthlySpent: currentMonthSummary.expense,
      savings: currentMonthSummary.net,
      budgetUsage: budgetHealth.percent,
      budgetOver: budgetHealth.over,
      overAmount,
    };
  }, [transactions, budget, todayStr]);

  // 4. Academic Readiness
  const academicStats = useMemo(() => {
    const nowMs = Date.now();
    const todayDate = parseLocalDate(todayStr);
    const upcoming = exams
      .filter((e) => {
        if (!isActive(e) || !e.examDate) return false;
        const examTs = new Date(`${e.examDate}T${e.examTime || '23:59'}`).getTime();
        return Number.isFinite(examTs) && examTs >= nowMs;
      })
      .sort((a, b) => {
        const aTs = new Date(`${a.examDate}T${a.examTime || '23:59'}`).getTime();
        const bTs = new Date(`${b.examDate}T${b.examTime || '23:59'}`).getTime();
        return aTs - bTs;
      });

    const nextExam = upcoming[0] ?? null;
    const nextExamDaysLeft = nextExam
      ? Math.max(
          0,
          Math.round(
            (parseLocalDate(nextExam.examDate).getTime() - todayDate.getTime()) /
              (24 * 60 * 60 * 1000)
          )
        )
      : null;

    return {
      upcomingCount: upcoming.length,
      nextExam,
      nextExamDaysLeft,
    };
  }, [exams, todayStr]);

  return (
    <div id="insights-view" className="space-y-6 animate-fadeIn pb-12">
      {/* Header + Time Range Control */}
      <div className="bg-gradient-to-b from-white to-slate-50/50 p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-900 text-white shadow-xs">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Review & Insights
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Reflect on task execution, habit consistency loops, and life check-in trends.
              </p>
            </div>
          </div>

          <div
            id="insights-range-control"
            role="group"
            aria-label="Insights time range"
            className="grid grid-cols-3 sm:inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto shrink-0"
          >
            {([
              { id: 'insights-range-7', label: '7 days', value: 7 as const },
              { id: 'insights-range-30', label: '30 days', value: 30 as const },
              { id: 'insights-range-all', label: 'All time', value: null },
            ]).map((opt) => {
              const isSelected = rangeDays === opt.value;
              return (
                <button
                  key={opt.id}
                  id={opt.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setRangeDays(opt.value)}
                  className={`min-h-[44px] px-2.5 sm:px-3.5 py-2 text-xs font-semibold rounded-lg transition cursor-pointer inline-flex items-center justify-center whitespace-nowrap ${
                    isSelected
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4 Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Productivity Pillar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Execution</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
              {taskStats.rate}%
            </span>
            <p className="text-xs text-slate-500 mt-1">
              Overall task completion ({taskStats.completed}/{taskStats.total})
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs font-medium flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <span className="text-emerald-700">
              {taskStats.completedInRange} completed{' '}
              {rangeDays === null ? 'across all time' : `in last ${rangeDays} days`}
            </span>
            <span className={taskStats.overdueCount > 0 ? 'text-rose-700 font-semibold' : 'text-slate-500'}>
              {taskStats.overdueCount} overdue
            </span>
          </div>
        </div>

        {/* Habits Pillar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Habits</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-500">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
              {habitStats.bestStreak}d
            </span>
            <p className="text-xs text-slate-500 mt-1">
              Best active streak ({habitStats.avgStreak}d average)
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-amber-700 font-medium">
            {habitStats.checkedInToday} of {habits.length} checked in today
          </div>
        </div>

        {/* Financial Health Pillar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Budget Health</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {financeStats.hasBudget ? (
              <span className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
                {financeStats.budgetUsage}%
              </span>
            ) : (
              <span className="text-xl sm:text-2xl font-extrabold text-slate-700 tracking-tight block leading-9">
                No budget set
              </span>
            )}
            {financeStats.hasBudget && financeStats.budgetOver ? (
              <p className="text-xs font-bold text-rose-700 mt-1">
                Over budget by {formatCurrency(financeStats.overAmount)}
              </p>
            ) : (
              <p className="text-xs text-slate-500 mt-1">
                {financeStats.hasBudget ? 'Monthly budget utilized' : 'Set a monthly budget in Finances'}
              </p>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-blue-700 font-medium">
            {formatCurrency(financeStats.savings)} net this month
          </div>
        </div>

        {/* Academic Pillar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Academic Focus</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-slate-900 font-mono">
              {academicStats.upcomingCount}
            </span>
            <p className="text-xs text-slate-500 mt-1">
              Upcoming scheduled exams
            </p>
          </div>
          <div
            className="mt-3 pt-3 border-t border-slate-100 text-xs text-indigo-700 font-medium truncate"
            title={
              academicStats.nextExam
                ? `${academicStats.nextExam.subject} · ${
                    academicStats.nextExamDaysLeft === 0
                      ? 'Today'
                      : academicStats.nextExamDaysLeft === 1
                      ? '1 day left'
                      : `${academicStats.nextExamDaysLeft} days left`
                  }`
                : 'No upcoming exams'
            }
          >
            {academicStats.nextExam
              ? `${academicStats.nextExam.subject} · ${
                  academicStats.nextExamDaysLeft === 0
                    ? 'Today'
                    : academicStats.nextExamDaysLeft === 1
                    ? '1 day left'
                    : `${academicStats.nextExamDaysLeft} days left`
                }`
              : 'No upcoming exams'}
          </div>
        </div>
      </div>

      {/* Life Overview Panel */}
      <div className="bg-slate-950 p-4 sm:p-6 rounded-2xl border border-slate-800 shadow-xl text-white space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400 shrink-0" />
          <h2 className="text-base font-bold text-white tracking-tight">
            Life overview
          </h2>
        </div>

        <LifeInsightsPanel
          habits={habits}
          dailyMetrics={filteredMetrics}
          rangeDays={rangeDays}
        />
      </div>

      {/* Weekly Review Summary Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-600" />
          <span>Weekly LifeTrack Reflection</span>
        </h2>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-sm text-slate-700 leading-relaxed">
          <p className="font-medium text-slate-900">
            {taskStats.total === 0
              ? 'No tasks logged yet'
              : taskStats.rate >= 70
              ? 'Strong week'
              : 'Room to grow'}
          </p>
          <p className="mt-1 text-slate-600 text-xs sm:text-sm">
            You have marked {taskStats.completed} tasks complete across your focus areas.
            {habitStats.bestStreak > 3 && ` Your best habit streak is currently ${habitStats.bestStreak} days.`}
            {financeStats.hasBudget && financeStats.budgetOver && (
              <span className="text-rose-700 font-semibold">
                {` Note: Over budget by ${formatCurrency(financeStats.overAmount)} (${financeStats.budgetUsage}% used).`}
              </span>
            )}
            {financeStats.hasBudget && !financeStats.budgetOver && financeStats.budgetUsage > 80 && (
              ` Note: your monthly budget is ${financeStats.budgetUsage}% used.`
            )}
          </p>
        </div>

        {/* Category distribution */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 mb-2">Tasks by Category</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(taskStats.categoryCount).map(([cat, count]) => (
              <div key={cat} className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <span className="text-xs text-slate-500 capitalize">{cat}</span>
                <span className="block text-lg font-bold text-slate-900">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Multi-Dimensional Life Correlations */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-600" />
              <span>Multi-Dimensional Life Correlations</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pearson correlation coefficients between sleep, hydration, exercise, and focus duration.
            </p>
          </div>
          {onSaveDailyMetric && (
            <button
              type="button"
              onClick={() => setIsCheckinOpen(true)}
              className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition cursor-pointer self-start sm:self-auto"
            >
              <Activity className="w-4 h-4 text-purple-600" />
              <span>Log Daily Check-In</span>
            </button>
          )}
        </div>

        {correlations.length === 0 ? (
          <div
            id="correlations-empty-state"
            className="p-5 sm:p-6 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-3"
          >
            <p className="text-xs sm:text-sm font-medium text-slate-600 max-w-md mx-auto">
              Log at least 3 days of sleep + mood (or focus/energy, water/energy) to see correlations
            </p>
            <button
              id="correlations-empty-checkin-btn"
              type="button"
              onClick={() => setIsCheckinOpen(true)}
              className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition cursor-pointer"
            >
              <Activity className="w-4 h-4 text-purple-600" />
              <span>Open Daily Check-In</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {correlations.map((c, idx) => {
                const conf =
                  c.confidence ??
                  (c.sampleSize < 7 ? 'low' : c.sampleSize < 14 ? 'medium' : 'high');
                const confLabel = `${conf.charAt(0).toUpperCase()}${conf.slice(1)} confidence`;

                return (
                  <div key={idx} className={`p-4 rounded-xl border ${c.color} space-y-2`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <span className="text-xs font-bold">{c.metricA} ↔ {c.metricB}</span>
                        {c.isSimulated === true && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                            Sample insight
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono font-extrabold px-2 py-0.5 rounded-full bg-white/80 shadow-2xs shrink-0">
                        r = {c.coefficient > 0 ? `+${c.coefficient}` : c.coefficient}
                      </span>
                    </div>
                    <p className="text-xs font-medium leading-snug">{c.insightText}</p>
                    <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] font-semibold opacity-85 pt-1 border-t border-current/20">
                      <span>{c.relationship}</span>
                      <span>{confLabel}</span>
                      <span>{c.sampleSize} days</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500">Correlation does not prove cause.</p>
          </div>
        )}
      </div>

      {/* Data Portability & Export / Backup Hub */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-slate-700" />
          <div>
            <h2 className="text-base font-bold text-slate-900">Data Portability & Backup Hub</h2>
            <p className="text-xs text-slate-500">
              Full data ownership: Export your habits, tasks, finances, or full JSON app backup at any time.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <button
            type="button"
            onClick={() => exportTasksCsv(tasks)}
            className="min-h-[44px] p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition flex items-center justify-between text-left cursor-pointer"
          >
            <div>
              <p className="text-xs font-bold text-slate-900">Tasks CSV</p>
              <p className="text-[10px] text-slate-500">{tasks.length} task records</p>
            </div>
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          </button>

          <button
            type="button"
            onClick={() => exportHabitsCsv(habits)}
            className="min-h-[44px] p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition flex items-center justify-between text-left cursor-pointer"
          >
            <div>
              <p className="text-xs font-bold text-slate-900">Habits CSV</p>
              <p className="text-[10px] text-slate-500">{habits.length} habit streaks</p>
            </div>
            <FileSpreadsheet className="w-4 h-4 text-orange-600" />
          </button>

          <button
            type="button"
            onClick={() => exportTransactionsCsv(transactions)}
            className="min-h-[44px] p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition flex items-center justify-between text-left cursor-pointer"
          >
            <div>
              <p className="text-xs font-bold text-slate-900">Finances CSV</p>
              <p className="text-[10px] text-slate-500">{transactions.filter(isActive).length} transactions</p>
            </div>
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
          </button>

          <button
            type="button"
            onClick={() => exportDailyMetricsCsv(dailyMetrics)}
            className="min-h-[44px] p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition flex items-center justify-between text-left cursor-pointer"
          >
            <div>
              <p className="text-xs font-bold text-slate-900">Metrics CSV</p>
              <p className="text-[10px] text-slate-500">{dailyMetrics.length} daily logs</p>
            </div>
            <FileSpreadsheet className="w-4 h-4 text-purple-600" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              if (appData) exportAppDataJson(appData);
            }}
            className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>Export Full JSON Backup</span>
          </button>

          {onRestoreAppData && (
            <label className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer">
              <Upload className="w-4 h-4 text-slate-600" />
              <span>Restore JSON Backup</span>
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const prepared = await prepareRestore(file);
                    setPendingRestore(prepared);
                    setBackupStatus(null);
                  } catch (err: any) {
                    setPendingRestore(null);
                    setBackupStatus({
                      type: 'error',
                      text: err?.message || "That file isn't valid JSON",
                    });
                    setTimeout(() => setBackupStatus(null), 4000);
                  } finally {
                    e.target.value = '';
                  }
                }}
              />
            </label>
          )}
        </div>

        {backupStatus && (
          <div
            role="status"
            aria-live="polite"
            className={`mt-3 p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              backupStatus.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-indigo-50 border-indigo-200 text-indigo-900'
            }`}
          >
            <CheckCircle2
              className={`w-4 h-4 shrink-0 ${
                backupStatus.type === 'error' ? 'text-rose-600' : 'text-indigo-600'
              }`}
            />
            <span>{backupStatus.text}</span>
          </div>
        )}
      </div>

      {/* Restore Confirmation Dialog */}
      {pendingRestore && onRestoreAppData && (
        <RestoreConfirmDialog
          isOpen={true}
          incomingSummary={pendingRestore.summary}
          currentSummary={currentSummary}
          onDownloadBackupFirst={() => exportAppDataJson(effectiveAppData)}
          onCancel={() => setPendingRestore(null)}
          onConfirmReplace={() => {
            onRestoreAppData(pendingRestore.data);
            setBackupStatus({
              type: 'success',
              text: pendingRestore.repaired
                ? 'Backup restored with integrity repairs.'
                : 'Data restored successfully!',
            });
            setPendingRestore(null);
            setTimeout(() => setBackupStatus(null), 3000);
          }}
        />
      )}

      {/* Daily Metrics Check-In Modal */}
      {(onSaveDailyMetric || isCheckinOpen) && (
        <DailyLifeCheckinModal
          isOpen={isCheckinOpen}
          onClose={() => setIsCheckinOpen(false)}
          existingMetric={dailyMetrics.find((m) => m.date === todayStr)}
          onSaveMetric={onSaveDailyMetric ?? (() => {})}
        />
      )}
    </div>
  );
};
