import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  CheckCircle2,
  Flame,
  Wallet,
  GraduationCap,
  Calendar,
  Sparkles,
  BarChart3,
  Award,
  Activity,
  Download,
  Upload,
  Database,
  FileSpreadsheet,
} from 'lucide-react';
import { Task, Habit, Transaction, BudgetSettings, ExamReminder, DailyLifeMetric, UserAppData } from '../../types/index.ts';
import { getLocalDateString } from '../../lib/dateUtils.ts';
import { analyzeLifeMetricCorrelations } from '../../lib/correlationEngine.ts';
import {
  exportAppDataJson,
  exportHabitsCsv,
  exportTasksCsv,
  exportTransactionsCsv,
  exportDailyMetricsCsv,
  parseAppDataJsonFile,
} from '../../lib/dataExport.ts';
import { DailyLifeCheckinModal } from '../insights/DailyLifeCheckinModal.tsx';
import { LifeDashboard } from '../../features/dashboard/LifeDashboard.tsx';
import { buildWeeklySummary, generateInsights } from '../../lib/analytics.ts';
import { calculateHabitScore } from '../../lib/habitScore.ts';

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
  const [isCheckinOpen, setIsCheckinOpen] = useState(false);

  const correlations = useMemo(() => {
    return analyzeLifeMetricCorrelations(dailyMetrics, tasks, habits);
  }, [dailyMetrics, tasks, habits]);

  // Analytics Engine Life Summary (from analytics.ts & habitScore.ts)
  const { weeklySummary, lifeInsights } = useMemo(() => {
    const habitLikes = habits.map((h) => {
      const totalDays = Math.max(1, Math.round((Date.now() - h.createdAt) / (1000 * 60 * 60 * 24)) + 1);
      const score = calculateHabitScore({
        completions: h.completedDates?.length || 0,
        totalDueDates: totalDays,
        currentStreak: h.streak || 0,
        longestStreak: h.bestStreak || h.streak || 0,
      });
      return {
        id: h.id,
        name: h.name,
        score: {
          currentStrength: score.currentStrength,
          completionRate: score.completionRate,
        },
      };
    });

    const metricLikes = dailyMetrics.map((m) => ({
      date: m.date,
      mood: m.moodLevel,
      energy: m.energyLevel,
      stress: m.stressLevel,
      sleepHours: m.sleepHours,
      steps: m.stepsCount,
      workoutDone: m.workoutDone,
    }));

    const summary = buildWeeklySummary(habitLikes, metricLikes);
    const insights = generateInsights(habitLikes, metricLikes);

    return { weeklySummary: summary, lifeInsights: insights };
  }, [habits, dailyMetrics]);

  // 1. Task Metrics
  const taskStats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.completed).length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Last 7 days completed tasks
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const completedRecently = tasks.filter(
      (t) => t.completed && t.completedAt && t.completedAt >= sevenDaysAgo
    ).length;

    // Categories breakdown
    const categoryCount: Record<string, number> = {};
    tasks.forEach((t) => {
      const cat = t.category || 'other';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });

    return { total, completed, rate, completedRecently, categoryCount };
  }, [tasks]);

  // 2. Habit Consistency
  const habitStats = useMemo(() => {
    if (habits.length === 0) return { avgStreak: 0, bestStreak: 0, checkedInToday: 0 };
    const bestStreak = Math.max(...habits.map((h) => h.streak || 0), 0);
    const avgStreak = Math.round(
      habits.reduce((sum, h) => sum + (h.streak || 0), 0) / habits.length
    );
    const checkedInToday = habits.filter(
      (h) => h.completedDates && h.completedDates.includes(todayStr)
    ).length;

    return { avgStreak, bestStreak, checkedInToday };
  }, [habits, todayStr]);

  // 3. Financial Review
  const financeStats = useMemo(() => {
    const totalIncome = transactions
      .filter((tx) => tx.type === 'income')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const totalExpense = transactions
      .filter((tx) => tx.type === 'expense')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const savings = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? Math.round((savings / totalIncome) * 100) : 0;
    const budgetUsage =
      budget.monthlyBudget > 0
        ? Math.round((totalExpense / budget.monthlyBudget) * 100)
        : 0;

    return { totalIncome, totalExpense, savings, savingsRate, budgetUsage };
  }, [transactions, budget]);

  // 4. Academic Readiness
  const academicStats = useMemo(() => {
    const upcoming = exams.filter(
      (e) => new Date(`${e.examDate}T${e.examTime || '23:59'}`).getTime() >= Date.now()
    );
    return { upcomingCount: upcoming.length };
  }, [exams]);

  return (
    <div id="insights-view" className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-900 text-white shadow-xs">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Review & Insights
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Reflect on your weekly execution, habit consistency, and financial balance.
            </p>
          </div>
        </div>
      </div>

      {/* 4 Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Productivity Pillar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Execution</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-slate-900 font-mono">
              {taskStats.rate}%
            </span>
            <p className="text-xs text-slate-500 mt-1">
              Overall task completion ({taskStats.completed}/{taskStats.total})
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-emerald-700 font-medium">
            +{taskStats.completedRecently} completed in past 7 days
          </div>
        </div>

        {/* Habits Pillar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Habits</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-500">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-slate-900 font-mono">
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
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Budget Health</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-slate-900 font-mono">
              {financeStats.budgetUsage}%
            </span>
            <p className="text-xs text-slate-500 mt-1">
              Monthly budget utilized
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-blue-700 font-medium">
            ${financeStats.savings.toLocaleString()} net balance
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
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-indigo-700 font-medium">
            Exam dates synchronized
          </div>
        </div>
      </div>

      {/* Executive Life Intelligence Dashboard (from src/features/dashboard/LifeDashboard.tsx) */}
      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl text-white space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Life Intelligence Engine (FxLifeSheet & Loop Analytics)
            </h2>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-900/60 text-purple-200 border border-purple-700 self-start sm:self-auto">
            Real-Time Synthesis
          </span>
        </div>

        <LifeDashboard
          totalHabits={weeklySummary.totalHabits}
          completionRate={weeklySummary.completionRate}
          averageMood={weeklySummary.averageMood}
          averageEnergy={weeklySummary.averageEnergy}
          averageSleep={weeklySummary.averageSleep}
          insights={lifeInsights}
        />
      </div>

      {/* Weekly Review Summary Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-600" />
          <span>Weekly LifeTrack Reflection</span>
        </h2>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-sm text-slate-700 leading-relaxed">
          <p className="font-medium text-slate-900">
            {taskStats.rate >= 70
              ? 'Excellent momentum this cycle!'
              : 'Steady progress in motion.'}
          </p>
          <p className="mt-1 text-slate-600 text-xs sm:text-sm">
            You have marked {taskStats.completed} tasks complete across your focus areas.
            {habitStats.bestStreak > 3 && ` Your best habit streak is currently ${habitStats.bestStreak} days.`}
            {financeStats.budgetUsage > 80 && ' Note: your monthly budget is over 80% utilized.'}
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

      {/* Multi-Dimensional Life Correlations (FxLifeSheet Model) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
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
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition cursor-pointer self-start sm:self-auto"
            >
              <Activity className="w-4 h-4 text-purple-600" />
              <span>Log Daily Check-In</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {correlations.map((c, idx) => (
            <div key={idx} className={`p-4 rounded-xl border ${c.color} space-y-2`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">{c.metricA} ↔ {c.metricB}</span>
                <span className="text-xs font-mono font-extrabold px-2 py-0.5 rounded-full bg-white/80 shadow-2xs">
                  r = {c.coefficient > 0 ? `+${c.coefficient}` : c.coefficient}
                </span>
              </div>
              <p className="text-xs font-medium leading-snug">{c.insightText}</p>
              <div className="flex items-center justify-between text-[10px] font-semibold opacity-75 pt-1 border-t border-current/20">
                <span>{c.relationship}</span>
                <span>{c.sampleSize} Days Analyzed</span>
              </div>
            </div>
          ))}
        </div>
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
            className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition flex items-center justify-between text-left cursor-pointer"
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
            className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition flex items-center justify-between text-left cursor-pointer"
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
            className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition flex items-center justify-between text-left cursor-pointer"
          >
            <div>
              <p className="text-xs font-bold text-slate-900">Finances CSV</p>
              <p className="text-[10px] text-slate-500">{transactions.length} transactions</p>
            </div>
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
          </button>

          <button
            type="button"
            onClick={() => exportDailyMetricsCsv(dailyMetrics)}
            className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition flex items-center justify-between text-left cursor-pointer"
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
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>Export Full JSON Backup</span>
          </button>

          {onRestoreAppData && (
            <label className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer">
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
                    const restored = await parseAppDataJsonFile(file);
                    if (confirm('Restore backup data? This will merge and update your active database.')) {
                      onRestoreAppData(restored);
                      alert('Data restored successfully!');
                    }
                  } catch (err) {
                    alert('Failed to parse JSON backup file.');
                  }
                }}
              />
            </label>
          )}
        </div>
      </div>

      {/* Daily Metrics Check-In Modal */}
      {onSaveDailyMetric && (
        <DailyLifeCheckinModal
          isOpen={isCheckinOpen}
          onClose={() => setIsCheckinOpen(false)}
          existingMetric={dailyMetrics.find((m) => m.date === todayStr)}
          onSaveMetric={onSaveDailyMetric}
        />
      )}
    </div>
  );
};
