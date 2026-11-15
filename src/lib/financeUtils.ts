import { Transaction } from '../types/index.ts';
import { getLocalDateOffset, getLocalDateString, getLocalMonthPrefix, parseLocalDate } from './dateUtils.ts';
import { isActive } from './entity.ts';

export type BudgetLevel = 'ok' | 'warn' | 'danger' | 'over';

export interface MonthSummary {
  income: number;
  expense: number;
  net: number;
  expenseByCategory: Record<string, number>;
  count: number;
}

export interface BudgetStatusResult {
  percent: number;
  remaining: number;
  over: boolean;
  level: BudgetLevel;
}

export interface TransactionDateGroup {
  key: string;
  label: string;
  date?: string;
  isUpcoming?: boolean;
  items: Transaction[];
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Extracts `YYYY-MM` month key from a `YYYY-MM-DD` (or `YYYY-MM`) date string.
 */
export function monthKey(date: string = getLocalDateString()): string {
  if (typeof date === 'string' && /^\d{4}-\d{2}/.test(date)) {
    return date.slice(0, 7);
  }
  return getLocalMonthPrefix();
}

/**
 * Shifts a `YYYY-MM` month key by `deltaMonths` (e.g. '2026-12' + 1 -> '2027-01').
 */
export function shiftMonthKey(ym: string, deltaMonths: number): string {
  const match = /^(\d{4})-(\d{2})$/.exec(ym);
  const baseYear = match ? Number(match[1]) : new Date().getFullYear();
  const baseMonthIndex = match ? Number(match[2]) - 1 : new Date().getMonth();
  const shifted = new Date(baseYear, baseMonthIndex + deltaMonths, 1);
  return getLocalMonthPrefix(shifted);
}

/**
 * Formats a `YYYY-MM` key into a readable month-year label (e.g. "November 2026").
 */
export function formatMonthLabel(ym: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!match) return ym;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function summarizeTransactions(
  transactions: Transaction[],
  todayStr: string,
  targetMonth?: string
): MonthSummary {
  let income = 0;
  let expense = 0;
  let count = 0;
  const expenseByCategory: Record<string, number> = {};

  for (const tx of transactions) {
    if (!isActive(tx)) continue;
    if (!tx.date || tx.date > todayStr) continue;
    if (targetMonth && monthKey(tx.date) !== targetMonth) continue;
    if (!Number.isFinite(tx.amount)) continue;

    count++;
    if (tx.type === 'income') {
      income += tx.amount;
    } else if (tx.type === 'expense') {
      expense += tx.amount;
      const cat = tx.category || 'Other';
      expenseByCategory[cat] = roundMoney((expenseByCategory[cat] || 0) + tx.amount);
    }
  }

  const roundedIncome = roundMoney(income);
  const roundedExpense = roundMoney(expense);
  return {
    income: roundedIncome,
    expense: roundedExpense,
    net: roundMoney(roundedIncome - roundedExpense),
    expenseByCategory,
    count,
  };
}

/**
 * Summarizes active, non-future transactions for a given `YYYY-MM` month.
 */
export function summarizeMonth(
  transactions: Transaction[],
  targetMonth: string,
  todayStr: string = getLocalDateString()
): MonthSummary {
  return summarizeTransactions(transactions, todayStr, monthKey(targetMonth));
}

/**
 * Summarizes all active, non-future transactions across all months.
 */
export function summarizeAllTime(
  transactions: Transaction[],
  todayStr: string = getLocalDateString()
): MonthSummary {
  return summarizeTransactions(transactions, todayStr);
}

/**
 * Computes budget utilization status with uncapped rounded percentage and remaining balance.
 * Thresholds: warn >= 70%, danger >= 90%, over > 100% (or spent > budget).
 */
export function budgetStatus(spent: number, budget: number): BudgetStatusResult {
  const safeSpent = Number.isFinite(spent) ? spent : 0;
  const safeBudget = Number.isFinite(budget) && budget > 0 ? budget : 0;

  if (safeBudget <= 0) {
    return {
      percent: 0,
      remaining: 0,
      over: false,
      level: 'ok',
    };
  }

  const percent = Math.round((safeSpent / safeBudget) * 100);
  const remaining = roundMoney(safeBudget - safeSpent);
  const over = safeSpent > safeBudget;

  let level: BudgetLevel = 'ok';
  if (over || percent > 100) {
    level = 'over';
  } else if (percent >= 90) {
    level = 'danger';
  } else if (percent >= 70) {
    level = 'warn';
  }

  return {
    percent,
    remaining,
    over,
    level,
  };
}

export interface CategoryBudgetMonthInput {
  limit?: number;
  spent: number;
}

/**
 * Computes this month's effective category limit when rollover is active.
 * Adds the previous month's remaining amount (limit - spent, which can be negative)
 * to this month's category limit. Returns undefined if this month has no limit.
 */
export function categoryAvailable(
  prevMonth: CategoryBudgetMonthInput | null | undefined,
  thisMonth: { limit?: number; spent?: number },
  rollover: boolean = true
): number | undefined {
  if (
    typeof thisMonth.limit !== 'number' ||
    !Number.isFinite(thisMonth.limit) ||
    thisMonth.limit < 0
  ) {
    return undefined;
  }
  if (
    !rollover ||
    !prevMonth ||
    typeof prevMonth.limit !== 'number' ||
    !Number.isFinite(prevMonth.limit) ||
    prevMonth.limit < 0
  ) {
    return roundMoney(thisMonth.limit);
  }
  const prevSpent = Number.isFinite(prevMonth.spent) ? prevMonth.spent : 0;
  const prevRemaining = roundMoney(prevMonth.limit - prevSpent);
  return roundMoney(thisMonth.limit + prevRemaining);
}

/**
 * Formats a `YYYY-MM-DD` transaction date into a human-readable header/label.
 */
export function formatTxDate(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  return parseLocalDate(ymd).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Groups active transactions under "Upcoming" (future-dated), "Today", "Yesterday",
 * or formatted date headers in reverse-chronological order.
 */
export function groupByDate(
  transactions: Transaction[],
  todayStr: string = getLocalDateString()
): TransactionDateGroup[] {
  const yesterdayStr = getLocalDateOffset(-1, parseLocalDate(todayStr));
  const upcoming: Transaction[] = [];
  const byPastOrTodayDate = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    if (!isActive(tx) || !tx.date) continue;
    if (tx.date > todayStr) {
      upcoming.push(tx);
    } else {
      let bucket = byPastOrTodayDate.get(tx.date);
      if (!bucket) {
        bucket = [];
        byPastOrTodayDate.set(tx.date, bucket);
      }
      bucket.push(tx);
    }
  }

  const groups: TransactionDateGroup[] = [];

  if (upcoming.length > 0) {
    upcoming.sort((a, b) => {
      const dDiff = a.date.localeCompare(b.date);
      if (dDiff !== 0) return dDiff;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    groups.push({
      key: 'upcoming',
      label: 'Upcoming',
      isUpcoming: true,
      items: upcoming,
    });
  }

  const sortedDates = Array.from(byPastOrTodayDate.keys()).sort((a, b) => b.localeCompare(a));
  for (const date of sortedDates) {
    const items = byPastOrTodayDate.get(date)!.sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
    );
    const label =
      date === todayStr
        ? 'Today'
        : date === yesterdayStr
        ? 'Yesterday'
        : formatTxDate(date);

    groups.push({
      key: date,
      label,
      date,
      items,
    });
  }

  return groups;
}
