import React, { useMemo } from 'react';
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
} from 'lucide-react';
import { Task, Habit, Transaction, BudgetSettings, ExamReminder } from '../../types/index.ts';

interface InsightsViewProps {
  tasks: Task[];
  habits: Habit[];
  transactions: Transaction[];
  budget: BudgetSettings;
  exams: ExamReminder[];
}

export const InsightsView: React.FC<InsightsViewProps> = ({
  tasks,
  habits,
  transactions,
  budget,
  exams,
}) => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

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
      (h) => h.completions && h.completions[todayStr]
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
            ₹{financeStats.savings.toLocaleString()} net balance
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
    </div>
  );
};
