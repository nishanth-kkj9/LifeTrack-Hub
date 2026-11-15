import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Search,
  Trash2,
  PieChart,
  ChevronLeft,
  ChevronRight,
  Repeat,
} from 'lucide-react';
import {
  Transaction,
  RecurringTransaction,
  BudgetSettings,
  TransactionType,
  FinanceCategory,
  FinancePaymentMethod,
} from '../../types/index.ts';
import { getLocalDateString } from '../../lib/dateUtils.ts';
import { isActive, restoreTransaction } from '../../lib/entity.ts';
import { formatCurrency } from '../../lib/format.ts';
import { AddTransactionModal } from '../modals/AddTransactionModal.tsx';
import {
  monthKey,
  shiftMonthKey,
  formatMonthLabel,
  summarizeMonth,
  summarizeAllTime,
  budgetStatus,
  categoryAvailable,
  groupByDate,
  formatTxDate,
  type BudgetLevel,
} from '../../lib/financeUtils.ts';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
} from '../../lib/financeCategories.ts';
import { getUpcomingBills } from '../../lib/recurringTransactions.ts';

interface FinancesViewProps {
  transactions: Transaction[];
  recurringTransactions?: RecurringTransaction[];
  budget: BudgetSettings;
  onAddTransaction: (transaction: Transaction) => void;
  onUpdateTransaction?: (transaction: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onRestoreTransaction?: (id: string) => void;
  onUpdateBudget: (budget: BudgetSettings) => void;
  onAddRecurringTransaction?: (schedule: RecurringTransaction) => void;
  onDeleteRecurringTransaction?: (id: string) => void;
  onOpenAddTransactionModal: () => void;
  handlesDeleteToast?: boolean;
}

export const FinancesView: React.FC<FinancesViewProps> = ({
  transactions,
  recurringTransactions = [],
  budget,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  onRestoreTransaction,
  onUpdateBudget,
  onAddRecurringTransaction,
  onDeleteRecurringTransaction,
  onOpenAddTransactionModal,
  handlesDeleteToast = false,
}) => {
  const todayStr = getLocalDateString();
  const currentMonth = monthKey(todayStr);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [isAllTime, setIsAllTime] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState((budget.monthlyBudget ?? 0).toString());
  const [savingsInput, setSavingsInput] = useState((budget.savingsGoal ?? 0).toString());
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [isEditingCategoryBudgets, setIsEditingCategoryBudgets] = useState(false);
  const [categoryBudgetInputs, setCategoryBudgetInputs] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const cat of EXPENSE_CATEGORIES) {
      const val = budget.categoryBudgets?.[cat];
      initial[cat] = typeof val === 'number' && Number.isFinite(val) ? String(val) : '';
    }
    return initial;
  });
  const [rolloverInput, setRolloverInput] = useState<boolean>(Boolean(budget.rollover));
  const [categoryBudgetError, setCategoryBudgetError] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [localDeletedTx, setLocalDeletedTx] = useState<Transaction | null>(null);
  const localUndoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isAddingRecurring, setIsAddingRecurring] = useState(false);
  const [recTitle, setRecTitle] = useState('');
  const [recAmount, setRecAmount] = useState('');
  const [recType, setRecType] = useState<TransactionType>('expense');
  const [recCategory, setRecCategory] = useState<FinanceCategory>('Bills & Utilities');
  const [recPaymentMethod, setRecPaymentMethod] = useState<FinancePaymentMethod>('Bank Transfer');
  const [recFrequency, setRecFrequency] = useState<'weekly' | 'monthly'>('monthly');
  const [recDayOfMonth, setRecDayOfMonth] = useState(() => String(Number(todayStr.split('-')[2]) || 1));
  const [recStartDate, setRecStartDate] = useState(todayStr);
  const [recEndDate, setRecEndDate] = useState('');
  const [recError, setRecError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditingBudget) {
      setBudgetInput((budget.monthlyBudget ?? 0).toString());
      setSavingsInput((budget.savingsGoal ?? 0).toString());
      setBudgetError(null);
    }
  }, [budget.monthlyBudget, budget.savingsGoal, isEditingBudget]);

  useEffect(() => {
    if (!isEditingCategoryBudgets) {
      const synced: Record<string, string> = {};
      for (const cat of EXPENSE_CATEGORIES) {
        const val = budget.categoryBudgets?.[cat];
        synced[cat] = typeof val === 'number' && Number.isFinite(val) ? String(val) : '';
      }
      setCategoryBudgetInputs(synced);
      setRolloverInput(Boolean(budget.rollover));
      setCategoryBudgetError(null);
    }
  }, [budget.categoryBudgets, budget.rollover, isEditingCategoryBudgets]);

  useEffect(() => {
    return () => {
      if (localUndoTimerRef.current) {
        clearTimeout(localUndoTimerRef.current);
        localUndoTimerRef.current = null;
      }
    };
  }, []);

  const handleDeleteRow = (tx: Transaction) => {
    onDeleteTransaction(tx.id);
    if (!handlesDeleteToast) {
      if (localUndoTimerRef.current) {
        clearTimeout(localUndoTimerRef.current);
      }
      setLocalDeletedTx(tx);
      localUndoTimerRef.current = setTimeout(() => {
        setLocalDeletedTx(null);
        localUndoTimerRef.current = null;
      }, 6000);
    }
  };

  const monthlyBudgetCap = budget.monthlyBudget ?? 0;
  const savingsGoal = budget.savingsGoal ?? 0;

  // Unified summaries driven by financeUtils
  const currentMonthSummary = useMemo(
    () => summarizeMonth(transactions, currentMonth, todayStr),
    [transactions, currentMonth, todayStr]
  );

  const selectedMonthSummary = useMemo(
    () => summarizeMonth(transactions, selectedMonth, todayStr),
    [transactions, selectedMonth, todayStr]
  );

  const savedThisMonth = Math.max(0, selectedMonthSummary.income - selectedMonthSummary.expense);
  const savingsPercent = savingsGoal > 0 ? Math.round((savedThisMonth / savingsGoal) * 100) : 0;
  const savingsBarWidth = Math.min(savingsPercent, 100);

  const allTimeSummary = useMemo(
    () => summarizeAllTime(transactions, todayStr),
    [transactions, todayStr]
  );

  const activeSummary = isAllTime ? allTimeSummary : selectedMonthSummary;
  const budgetTargetSummary = isAllTime ? currentMonthSummary : selectedMonthSummary;
  const budgetHealth = budgetStatus(budgetTargetSummary.expense, monthlyBudgetCap);
  const budgetBarWidth = Math.min(budgetHealth.percent, 100);

  // Scoped non-future active transactions for credit/purchase counts
  const scopedSummaryTransactions = useMemo(
    () =>
      transactions.filter(
        (tx) =>
          isActive(tx) &&
          tx.date <= todayStr &&
          (isAllTime || monthKey(tx.date) === selectedMonth)
      ),
    [transactions, todayStr, isAllTime, selectedMonth]
  );
  const incomeCount = scopedSummaryTransactions.filter((t) => t.type === 'income').length;
  const expenseCount = scopedSummaryTransactions.filter((t) => t.type === 'expense').length;

  const prevMonthKey = useMemo(() => shiftMonthKey(selectedMonth, -1), [selectedMonth]);
  const prevMonthSummary = useMemo(
    () => summarizeMonth(transactions, prevMonthKey, todayStr),
    [transactions, prevMonthKey, todayStr]
  );

  const activeRecurringSchedules = useMemo(
    () => recurringTransactions.filter(isActive),
    [recurringTransactions]
  );

  const upcomingBills = useMemo(
    () => getUpcomingBills(activeRecurringSchedules, todayStr, 30),
    [activeRecurringSchedules, todayStr]
  );

  const upcomingBillsTotal = useMemo(
    () => upcomingBills.reduce((sum, bill) => sum + bill.amount, 0),
    [upcomingBills]
  );

  const categoryRows = useMemo(() => {
    const categoryNames = new Set<string>(Object.keys(activeSummary.expenseByCategory));
    if (!isAllTime && budget.categoryBudgets) {
      for (const [cat, limit] of Object.entries(budget.categoryBudgets)) {
        if (typeof limit === 'number' && Number.isFinite(limit) && limit >= 0) {
          categoryNames.add(cat);
        }
      }
    }

    const rows = Array.from(categoryNames).map((category) => {
      const spent = activeSummary.expenseByCategory[category] || 0;
      const baseLimit = !isAllTime ? budget.categoryBudgets?.[category] : undefined;
      const hasLimit =
        typeof baseLimit === 'number' && Number.isFinite(baseLimit) && baseLimit >= 0;

      if (!hasLimit) {
        return {
          category,
          spent,
          limit: undefined as number | undefined,
          status: null as ReturnType<typeof budgetStatus> | null,
        };
      }

      const prevSpent = prevMonthSummary.expenseByCategory[category] || 0;
      const effectiveLimit = categoryAvailable(
        { limit: baseLimit, spent: prevSpent },
        { limit: baseLimit, spent },
        Boolean(budget.rollover)
      );

      if (effectiveLimit === undefined) {
        return {
          category,
          spent,
          limit: undefined as number | undefined,
          status: null as ReturnType<typeof budgetStatus> | null,
        };
      }

      const status =
        effectiveLimit > 0
          ? budgetStatus(spent, effectiveLimit)
          : {
              percent: spent > effectiveLimit ? 100 : 0,
              remaining: Math.round((effectiveLimit - spent) * 100) / 100,
              over: spent > effectiveLimit,
              level: (spent > effectiveLimit ? 'over' : 'ok') as BudgetLevel,
            };

      return {
        category,
        spent,
        limit: effectiveLimit,
        status,
      };
    });

    return rows.sort((a, b) => {
      const aOver = Boolean(a.status?.over);
      const bOver = Boolean(b.status?.over);
      if (aOver !== bOver) return aOver ? -1 : 1;
      if (aOver && bOver) {
        const aExcess = a.spent - (a.limit ?? 0);
        const bExcess = b.spent - (b.limit ?? 0);
        if (bExcess !== aExcess) return bExcess - aExcess;
      }
      if (b.spent !== a.spent) return b.spent - a.spent;
      return a.category.localeCompare(b.category);
    });
  }, [
    activeSummary.expenseByCategory,
    budget.categoryBudgets,
    budget.rollover,
    isAllTime,
    prevMonthSummary.expenseByCategory,
  ]);

  const handleSaveBudget = () => {
    const rawBudget = budgetInput.trim();
    const rawSavings = savingsInput.trim();
    const newBudget = rawBudget === '' ? NaN : Number(rawBudget);
    const newSavings = rawSavings === '' ? NaN : Number(rawSavings);
    if (!Number.isFinite(newBudget) || newBudget < 0 || !Number.isFinite(newSavings) || newSavings < 0) {
      setBudgetError('Budget and savings goal must be non-negative finite numbers.');
      return;
    }
    setBudgetError(null);
    onUpdateBudget({
      ...budget,
      monthlyBudget: newBudget,
      savingsGoal: newSavings,
    });
    setIsEditingBudget(false);
  };

  const handleSaveCategoryBudgets = (e?: React.FormEvent) => {
    e?.preventDefault();
    const nextCategoryBudgets: Record<string, number> = {};
    for (const cat of EXPENSE_CATEGORIES) {
      const raw = (categoryBudgetInputs[cat] ?? '').trim();
      if (raw === '') continue;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setCategoryBudgetError(`Invalid limit for ${cat}: enter a number >= 0 or leave blank.`);
        return;
      }
      nextCategoryBudgets[cat] = parsed;
    }
    setCategoryBudgetError(null);
    onUpdateBudget({
      ...budget,
      categoryBudgets: nextCategoryBudgets,
      rollover: rolloverInput,
    });
    setIsEditingCategoryBudgets(false);
  };

  const handleCreateRecurring = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddRecurringTransaction) return;
    const trimmedTitle = recTitle.trim();
    const parsedAmount = Number(recAmount);
    if (!trimmedTitle) {
      setRecError('Title is required.');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setRecError('Amount must be greater than 0.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(recStartDate)) {
      setRecError('Valid start date is required.');
      return;
    }
    if (recEndDate && (!/^\d{4}-\d{2}-\d{2}$/.test(recEndDate) || recEndDate < recStartDate)) {
      setRecError('End date must be on or after start date.');
      return;
    }
    let parsedDay: number | undefined;
    if (recFrequency === 'monthly') {
      const d = Number(recDayOfMonth);
      if (!Number.isInteger(d) || d < 1 || d > 31) {
        setRecError('Day of month must be an integer between 1 and 31.');
        return;
      }
      parsedDay = d;
    }

    setRecError(null);
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `rec-${crypto.randomUUID()}`
        : `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    onAddRecurringTransaction({
      id,
      title: trimmedTitle,
      amount: parsedAmount,
      type: recType,
      category: recCategory,
      paymentMethod: recPaymentMethod,
      frequency: recFrequency,
      ...(parsedDay !== undefined ? { dayOfMonth: parsedDay } : {}),
      startDate: recStartDate,
      ...(recEndDate ? { endDate: recEndDate } : {}),
      createdAt: Date.now(),
    });
    setRecTitle('');
    setRecAmount('');
    setRecEndDate('');
    setIsAddingRecurring(false);
  };

  // Filtered transactions for ledger + date grouping
  const filteredTransactions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (!isActive(tx)) return false;
      if (!isAllTime) {
        const inSelectedMonth = monthKey(tx.date) === selectedMonth;
        const isUpcomingFromThisMonth = selectedMonth === currentMonth && tx.date > todayStr;
        if (!inSelectedMonth && !isUpcomingFromThisMonth) return false;
      }
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      if (
        q &&
        !tx.title.toLowerCase().includes(q) &&
        !(tx.category || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [transactions, isAllTime, selectedMonth, currentMonth, todayStr, typeFilter, searchTerm]);

  const groupedTransactions = useMemo(
    () => groupByDate(filteredTransactions, todayStr),
    [filteredTransactions, todayStr]
  );

  const scopeSubtitle = isAllTime ? 'All time (excluding upcoming)' : formatMonthLabel(selectedMonth);

  return (
    <div id="finances-view-container" className="space-y-6 pb-12 animate-fadeIn">
      {/* Header and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-b from-white to-slate-50/50 p-4 sm:p-6 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Finances & Cashflow</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track student spending, monitor monthly budget caps, and balance cashflow.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Month Selector: Prev / Label / Next + This month */}
          <div className="flex items-center bg-slate-100/80 rounded-xl p-1 border border-slate-200/70 max-w-full">
            <button
              type="button"
              id="finances-prev-month-btn"
              onClick={() => {
                setIsAllTime(false);
                setSelectedMonth((prev) => shiftMonthKey(prev, -1));
              }}
              aria-label="Previous month"
              className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-all cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span
              id="finances-month-label"
              className={`text-xs font-bold px-2 sm:px-3 min-w-[104px] sm:min-w-[120px] text-center whitespace-nowrap ${
                isAllTime ? 'text-slate-400' : 'text-slate-800'
              }`}
            >
              {formatMonthLabel(selectedMonth)}
            </span>
            <button
              type="button"
              id="finances-next-month-btn"
              onClick={() => {
                setIsAllTime(false);
                setSelectedMonth((prev) => shiftMonthKey(prev, 1));
              }}
              aria-label="Next month"
              className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-all cursor-pointer shrink-0"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            id="finances-this-month-btn"
            onClick={() => {
              setSelectedMonth(currentMonth);
              setIsAllTime(false);
            }}
            className={`px-3 py-2 text-xs font-semibold rounded-xl border transition cursor-pointer whitespace-nowrap shrink-0 ${
              !isAllTime && selectedMonth === currentMonth
                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            This month
          </button>

          <button
            type="button"
            id="finances-all-time-toggle"
            role="switch"
            aria-checked={isAllTime}
            onClick={() => setIsAllTime((prev) => !prev)}
            className={`px-3 py-2 text-xs font-semibold rounded-xl border transition cursor-pointer whitespace-nowrap shrink-0 ${
              isAllTime
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            All time
          </button>

          <button
            id="finances-add-tx-btn"
            onClick={onOpenAddTransactionModal}
            className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition cursor-pointer shadow-xs hover:shadow-sm min-h-[36px] whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {/* 4 Financial Stat Cards (2x2 on <640px with Net & Budget first) */}
      <div
        data-testid="finances-stats-grid"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
      >
        {/* 1. Net Cashflow */}
        <div
          data-testid="finances-stat-net"
          className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:border-slate-300 transition-colors min-w-0"
        >
          <div className="flex items-center justify-between gap-1.5 text-slate-400 mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">
              Net Cashflow
            </span>
            <span className="p-1.5 sm:p-2 rounded-xl bg-slate-100 text-slate-700 shrink-0">
              <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </span>
          </div>
          <p
            className={`text-lg sm:text-2xl font-black tabular-nums tracking-tight truncate ${
              activeSummary.net >= 0 ? 'text-slate-900' : 'text-rose-600'
            }`}
          >
            {formatCurrency(activeSummary.net)}
          </p>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1 truncate">{scopeSubtitle}</p>
        </div>

        {/* 2. Monthly Budget */}
        <div
          data-testid="finances-stat-budget"
          className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:border-slate-300 transition-colors min-w-0"
        >
          <div className="flex items-center justify-between gap-1.5 text-slate-400 mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">
              Monthly Budget
            </span>
            <button
              id="finances-edit-budget-toggle"
              onClick={() => {
                setBudgetInput((budget.monthlyBudget ?? 0).toString());
                setSavingsInput((budget.savingsGoal ?? 0).toString());
                setIsEditingBudget(!isEditingBudget);
              }}
              className="text-[11px] sm:text-xs font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer shrink-0 whitespace-nowrap"
            >
              {isEditingBudget ? 'Cancel' : 'Edit Cap'}
            </button>
          </div>

          {isEditingBudget ? (
            <div className="space-y-2">
              <div>
                <label htmlFor="finances-budget-input" className="block text-[10px] font-bold text-slate-500 mb-0.5">
                  Monthly Cap (₹)
                </label>
                <input
                  id="finances-budget-input"
                  type="number"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-1.5 font-bold focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  placeholder="Budget cap (₹)"
                />
              </div>
              <div>
                <label htmlFor="finances-savings-input" className="block text-[10px] font-bold text-slate-500 mb-0.5">
                  Monthly Savings Goal (₹)
                </label>
                <input
                  id="finances-savings-input"
                  type="number"
                  value={savingsInput}
                  onChange={(e) => setSavingsInput(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-1.5 font-bold focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  placeholder="Savings target (₹)"
                />
              </div>
              {budgetError && (
                <p
                  data-testid="finances-budget-error"
                  role="alert"
                  className="text-[11px] font-semibold text-rose-600"
                >
                  {budgetError}
                </p>
              )}
              <button
                id="finances-budget-save-btn"
                onClick={handleSaveBudget}
                className="w-full py-1.5 text-xs font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                Save Budget & Goal
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-1.5 min-w-0">
                <span className="text-lg sm:text-2xl font-black tabular-nums tracking-tight text-slate-900 truncate min-w-0">
                  {formatCurrency(monthlyBudgetCap)}
                </span>
                <span
                  data-testid="finances-budget-percent"
                  className={`text-[11px] sm:text-xs font-bold tabular-nums shrink-0 whitespace-nowrap ${
                    budgetHealth.over || budgetHealth.level === 'danger'
                      ? 'text-rose-600'
                      : budgetHealth.level === 'warn'
                      ? 'text-amber-600'
                      : 'text-slate-500'
                  }`}
                >
                  {budgetHealth.percent}% used
                </span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2.5 sm:mt-3">
                <div
                  data-testid="finances-budget-bar"
                  className={`h-full rounded-full transition-all duration-500 ${
                    budgetHealth.level === 'over' || budgetHealth.level === 'danger'
                      ? 'bg-rose-500'
                      : budgetHealth.level === 'warn'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${budgetBarWidth}%` }}
                />
              </div>
              <div className="mt-1.5 sm:mt-2 text-[11px] sm:text-xs font-semibold truncate">
                {budgetHealth.over ? (
                  <span data-testid="finances-budget-remaining" className="text-rose-600">
                    Over by {formatCurrency(Math.abs(budgetHealth.remaining))}
                  </span>
                ) : (
                  <span data-testid="finances-budget-remaining" className="text-slate-600">
                    {formatCurrency(Math.max(0, budgetHealth.remaining))} left
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* 3. Total Income */}
        <div
          data-testid="finances-stat-income"
          className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:border-slate-300 transition-colors min-w-0"
        >
          <div className="flex items-center justify-between gap-1.5 text-slate-400 mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">
              Total Income
            </span>
            <span className="p-1.5 sm:p-2 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </span>
          </div>
          <p className="text-lg sm:text-2xl font-black tabular-nums tracking-tight text-emerald-600 truncate">
            +{formatCurrency(activeSummary.income)}
          </p>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1 truncate">
            {incomeCount} {incomeCount === 1 ? 'credit' : 'credits'}
          </p>
        </div>

        {/* 4. Total Expense */}
        <div
          data-testid="finances-stat-expense"
          className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:border-slate-300 transition-colors min-w-0"
        >
          <div className="flex items-center justify-between gap-1.5 text-slate-400 mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">
              Total Expenses
            </span>
            <span className="p-1.5 sm:p-2 rounded-xl bg-rose-50 text-rose-600 shrink-0">
              <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </span>
          </div>
          <p className="text-lg sm:text-2xl font-black tabular-nums tracking-tight text-slate-900 truncate">
            -{formatCurrency(activeSummary.expense)}
          </p>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1 truncate">
            {expenseCount} {expenseCount === 1 ? 'purchase' : 'purchases'}
          </p>
        </div>
      </div>

      {/* Main Breakdown & Transactions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Transaction Log */}
        <div className="lg:col-span-2 space-y-4 min-w-0">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-base font-bold text-slate-900">Transaction History</h2>

              <div
                data-testid="finances-filters-toolbar"
                className="flex flex-wrap items-center gap-2 w-full sm:w-auto"
              >
                {/* Type filter */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold shrink-0">
                  <button
                    id="finances-filter-all-btn"
                    onClick={() => setTypeFilter('all')}
                    className={`px-2.5 py-1 rounded-lg cursor-pointer whitespace-nowrap ${
                      typeFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    All
                  </button>
                  <button
                    id="finances-filter-income-btn"
                    onClick={() => setTypeFilter('income')}
                    className={`px-2.5 py-1 rounded-lg cursor-pointer whitespace-nowrap ${
                      typeFilter === 'income' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Income
                  </button>
                  <button
                    id="finances-filter-expense-btn"
                    onClick={() => setTypeFilter('expense')}
                    className={`px-2.5 py-1 rounded-lg cursor-pointer whitespace-nowrap ${
                      typeFilter === 'expense' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Expenses
                  </button>
                </div>

                {/* Search */}
                <div className="relative flex-1 min-w-[180px] sm:flex-initial sm:min-w-0 sm:w-44">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="finances-search-input"
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Grouped Transaction List */}
            {groupedTransactions.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl space-y-3">
                <DollarSign className="w-8 h-8 text-slate-300 mx-auto" />
                <div>
                  <p className="text-xs font-bold text-slate-700">No transactions recorded</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Track your expenses or income to view your cashflow ledger.</p>
                </div>
                <button
                  type="button"
                  onClick={onOpenAddTransactionModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Transaction</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {groupedTransactions.map((group) => (
                  <div key={group.key} data-testid={`finances-date-group-${group.key}`} className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span
                        className={`text-xs font-bold uppercase tracking-wider ${
                          group.isUpcoming ? 'text-indigo-600' : 'text-slate-500'
                        }`}
                      >
                        {group.label}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">{group.items.length}</span>
                    </div>
                    <div className="space-y-2">
                      {group.items.map((tx) => (
                        <div
                          key={tx.id}
                          id={`transaction-row-${tx.id}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => setEditingTransaction(tx)}
                          onKeyDown={(e) => {
                            if (e.target !== e.currentTarget) return;
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setEditingTransaction(tx);
                            }
                          }}
                          className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer min-w-0"
                        >
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                              tx.type === 'income'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {tx.type === 'income' ? '+' : '-'}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2 min-w-0">
                              <p className="font-semibold text-xs sm:text-sm text-slate-900 truncate min-w-0">
                                {tx.title}
                              </p>
                              <span
                                className={`font-mono tabular-nums text-xs sm:text-sm font-bold shrink-0 whitespace-nowrap ${
                                  tx.type === 'income' ? 'text-emerald-600' : 'text-slate-900'
                                }`}
                              >
                                {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                              {tx.category} · {tx.paymentMethod}
                            </p>
                          </div>

                          <button
                            type="button"
                            id={`transaction-delete-${tx.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRow(tx);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition cursor-pointer shrink-0"
                            title="Delete transaction"
                            aria-label={`Delete ${tx.title}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Savings Goal + Category Spending Breakdown */}
        <div className="space-y-4 min-w-0">
          {savingsGoal > 0 && (
            <div
              data-testid="finances-savings-goal-card"
              className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <h2 className="text-sm font-bold text-slate-900">Saved this month</h2>
                <span className="text-[11px] font-medium text-slate-400 truncate">
                  {formatMonthLabel(selectedMonth)}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2 min-w-0">
                <span className="text-lg sm:text-xl font-black tabular-nums text-slate-900 truncate">
                  {formatCurrency(savedThisMonth)}
                </span>
                <span className="text-xs font-semibold tabular-nums text-slate-500 shrink-0 whitespace-nowrap">
                  of {formatCurrency(savingsGoal)} ({savingsPercent}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-3">
                <div
                  data-testid="finances-savings-goal-bar"
                  className={`h-full rounded-full transition-all duration-300 ${
                    savedThisMonth >= savingsGoal ? 'bg-emerald-500' : 'bg-indigo-600'
                  }`}
                  style={{ width: `${savingsBarWidth}%` }}
                />
              </div>
            </div>
          )}

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 min-w-0">
                <PieChart className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="truncate">Expense Categories</span>
              </h2>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap">
                  {isAllTime ? 'All time' : formatMonthLabel(selectedMonth)}
                </span>
                <button
                  type="button"
                  id="finances-edit-category-budgets-btn"
                  onClick={() => {
                    if (!isEditingCategoryBudgets) {
                      const synced: Record<string, string> = {};
                      for (const cat of EXPENSE_CATEGORIES) {
                        const val = budget.categoryBudgets?.[cat];
                        synced[cat] =
                          typeof val === 'number' && Number.isFinite(val) ? String(val) : '';
                      }
                      setCategoryBudgetInputs(synced);
                      setRolloverInput(Boolean(budget.rollover));
                      setCategoryBudgetError(null);
                    }
                    setIsEditingCategoryBudgets((prev) => !prev);
                  }}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer whitespace-nowrap"
                >
                  {isEditingCategoryBudgets ? 'Cancel' : 'Edit budgets'}
                </button>
              </div>
            </div>

            {isEditingCategoryBudgets ? (
              <form
                noValidate
                onSubmit={handleSaveCategoryBudgets}
                data-testid="finances-edit-budgets-panel"
                className="space-y-3"
              >
                <label className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-700 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 cursor-pointer">
                  <span>Rollover unused/overspent</span>
                  <input
                    id="finances-rollover-checkbox"
                    type="checkbox"
                    checked={rolloverInput}
                    onChange={(e) => setRolloverInput(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </label>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <div key={cat} className="flex items-center justify-between gap-2 min-w-0">
                      <label
                        htmlFor={`category-budget-input-${cat}`}
                        className="text-xs font-medium text-slate-700 truncate min-w-0"
                      >
                        {cat}
                      </label>
                      <input
                        id={`category-budget-input-${cat}`}
                        data-testid={`category-budget-input-${cat}`}
                        type="number"
                        step="any"
                        placeholder="No limit"
                        value={categoryBudgetInputs[cat] ?? ''}
                        onChange={(e) =>
                          setCategoryBudgetInputs((prev) => ({
                            ...prev,
                            [cat]: e.target.value,
                          }))
                        }
                        className="w-24 sm:w-28 shrink-0 px-2.5 py-1 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-right"
                      />
                    </div>
                  ))}
                </div>

                {categoryBudgetError && (
                  <p
                    data-testid="finances-category-budget-error"
                    role="alert"
                    className="text-[11px] font-semibold text-rose-600"
                  >
                    {categoryBudgetError}
                  </p>
                )}

                <button
                  type="submit"
                  id="finances-save-category-budgets-btn"
                  className="w-full py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
                >
                  Save Budgets
                </button>
              </form>
            ) : categoryRows.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">No expenses recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {categoryRows.map(({ category, spent, limit, status }) => {
                  const isOver = Boolean(status?.over);
                  const pctOfExpense =
                    activeSummary.expense > 0
                      ? Math.round((spent / activeSummary.expense) * 100)
                      : 0;
                  return (
                    <div
                      key={category}
                      data-testid={`expense-category-row-${category}`}
                      className="space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs font-semibold min-w-0">
                        <span
                          className={`truncate min-w-0 ${
                            isOver ? 'text-rose-600 font-bold' : 'text-slate-700'
                          }`}
                        >
                          {category}
                        </span>
                        {status && limit !== undefined ? (
                          <span
                            className={`font-mono tabular-nums shrink-0 whitespace-nowrap ${
                              isOver ? 'text-rose-600 font-bold' : 'text-slate-900'
                            }`}
                          >
                            {formatCurrency(spent)} / {formatCurrency(limit)}
                          </span>
                        ) : (
                          <span className="text-slate-900 font-mono tabular-nums shrink-0 whitespace-nowrap">
                            {formatCurrency(spent)} ({pctOfExpense}%)
                          </span>
                        )}
                      </div>
                      {status && limit !== undefined && (
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            data-testid={`expense-category-bar-${category}`}
                            className={`h-full rounded-full transition-all duration-300 ${
                              status.level === 'over' || status.level === 'danger'
                                ? 'bg-rose-500'
                                : status.level === 'warn'
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(Math.max(status.percent, 0), 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming Bills (next 30 days) */}
          <div
            data-testid="finances-upcoming-bills-card"
            className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 min-w-0">
                <Repeat className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="truncate">Upcoming bills (next 30 days)</span>
              </h2>
              <div className="flex items-center gap-2 shrink-0">
                {upcomingBillsTotal > 0 && (
                  <span
                    data-testid="upcoming-bills-total"
                    className="text-xs font-mono font-bold text-slate-700 whitespace-nowrap"
                  >
                    {formatCurrency(upcomingBillsTotal)}
                  </span>
                )}
                {onAddRecurringTransaction && (
                  <button
                    type="button"
                    id="finances-add-recurring-btn"
                    onClick={() => {
                      setRecError(null);
                      setIsAddingRecurring((prev) => !prev);
                    }}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer whitespace-nowrap"
                  >
                    {isAddingRecurring ? 'Cancel' : '+ Add'}
                  </button>
                )}
              </div>
            </div>

            {isAddingRecurring && onAddRecurringTransaction && (
              <form
                noValidate
                onSubmit={handleCreateRecurring}
                data-testid="finances-add-recurring-form"
                className="space-y-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200"
              >
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRecType('expense');
                      setRecCategory(EXPENSE_CATEGORIES[0]);
                    }}
                    className={`py-1 text-xs font-bold rounded-lg cursor-pointer ${
                      recType === 'expense'
                        ? 'bg-rose-600 text-white'
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRecType('income');
                      setRecCategory(INCOME_CATEGORIES[0]);
                    }}
                    className={`py-1 text-xs font-bold rounded-lg cursor-pointer ${
                      recType === 'income'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    Income
                  </button>
                </div>

                <input
                  id="recurring-title-input"
                  type="text"
                  placeholder="Title (e.g. Hostel Rent)"
                  value={recTitle}
                  onChange={(e) => setRecTitle(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />

                <div className="grid grid-cols-2 gap-2">
                  <input
                    id="recurring-amount-input"
                    type="number"
                    step="any"
                    placeholder="Amount (₹)"
                    value={recAmount}
                    onChange={(e) => setRecAmount(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <select
                    id="recurring-frequency-select"
                    value={recFrequency}
                    onChange={(e) => setRecFrequency(e.target.value as 'weekly' | 'monthly')}
                    className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    id="recurring-category-select"
                    value={recCategory}
                    onChange={(e) => setRecCategory(e.target.value as FinanceCategory)}
                    className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {(recType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <select
                    id="recurring-method-select"
                    value={recPaymentMethod}
                    onChange={(e) => setRecPaymentMethod(e.target.value as FinancePaymentMethod)}
                    className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="recurring-start-input" className="block text-[10px] font-bold text-slate-500 mb-0.5">
                      Start date
                    </label>
                    <input
                      id="recurring-start-input"
                      type="date"
                      value={recStartDate}
                      onChange={(e) => setRecStartDate(e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                  {recFrequency === 'monthly' ? (
                    <div>
                      <label htmlFor="recurring-day-input" className="block text-[10px] font-bold text-slate-500 mb-0.5">
                        Day of month (1-31)
                      </label>
                      <input
                        id="recurring-day-input"
                        type="number"
                        min="1"
                        max="31"
                        value={recDayOfMonth}
                        onChange={(e) => setRecDayOfMonth(e.target.value)}
                        className="w-full px-2 py-1 text-xs font-mono bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="recurring-end-input" className="block text-[10px] font-bold text-slate-500 mb-0.5">
                        End date (optional)
                      </label>
                      <input
                        id="recurring-end-input"
                        type="date"
                        value={recEndDate}
                        onChange={(e) => setRecEndDate(e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                  )}
                </div>

                {recFrequency === 'monthly' && (
                  <div>
                    <label htmlFor="recurring-end-input" className="block text-[10px] font-bold text-slate-500 mb-0.5">
                      End date (optional)
                    </label>
                    <input
                      id="recurring-end-input"
                      type="date"
                      value={recEndDate}
                      onChange={(e) => setRecEndDate(e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                )}

                {recError && (
                  <p role="alert" className="text-[11px] font-semibold text-rose-600">
                    {recError}
                  </p>
                )}

                <button
                  type="submit"
                  id="recurring-save-btn"
                  className="w-full py-1.5 text-xs font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  Save Schedule
                </button>
              </form>
            )}

            {upcomingBills.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2 text-center">
                No upcoming bills in the next 30 days.
              </p>
            ) : (
              <div data-testid="upcoming-bills-list" className="space-y-2">
                {upcomingBills.map((bill) => (
                  <div
                    key={bill.key}
                    data-testid={`upcoming-bill-row-${bill.key}`}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 min-w-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {bill.title}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {formatTxDate(bill.date)} · {bill.frequency} · {bill.category}
                      </p>
                    </div>
                    <span className="font-mono tabular-nums text-xs font-bold text-slate-900 shrink-0 whitespace-nowrap">
                      -{formatCurrency(bill.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {activeRecurringSchedules.length > 0 && onDeleteRecurringTransaction && (
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Active Schedules
                </p>
                {activeRecurringSchedules.map((sched) => (
                  <div
                    key={sched.id}
                    data-testid={`recurring-schedule-row-${sched.id}`}
                    className="flex items-center justify-between gap-2 text-[11px] text-slate-600 min-w-0"
                  >
                    <span className="truncate min-w-0">
                      {sched.title} ({sched.frequency})
                    </span>
                    <button
                      type="button"
                      data-testid={`recurring-schedule-delete-${sched.id}`}
                      onClick={() => onDeleteRecurringTransaction(sched.id)}
                      className="p-1 text-slate-400 hover:text-rose-500 rounded cursor-pointer shrink-0"
                      aria-label={`Delete schedule ${sched.title}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <AddTransactionModal
        isOpen={Boolean(editingTransaction)}
        onClose={() => setEditingTransaction(null)}
        onAddTransaction={onAddTransaction}
        onUpdateTransaction={(updated) => {
          onUpdateTransaction?.(updated);
        }}
        initialTransaction={editingTransaction}
      />

      {!handlesDeleteToast && localDeletedTx && (
        <div
          id="tx-undo-toast-banner"
          data-testid="tx-undo-toast"
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-[60] bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-lg border border-slate-700 text-xs font-bold flex items-center gap-3"
        >
          <span>Transaction deleted - </span>
          <button
            type="button"
            id="tx-undo-toast-btn"
            onClick={() => {
              const tx = localDeletedTx;
              if (localUndoTimerRef.current) {
                clearTimeout(localUndoTimerRef.current);
                localUndoTimerRef.current = null;
              }
              setLocalDeletedTx(null);
              if (onRestoreTransaction) {
                onRestoreTransaction(tx.id);
              } else {
                onAddTransaction(restoreTransaction(tx));
              }
            }}
            className="text-emerald-400 hover:text-emerald-300 underline cursor-pointer font-extrabold"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => {
              if (localUndoTimerRef.current) {
                clearTimeout(localUndoTimerRef.current);
                localUndoTimerRef.current = null;
              }
              setLocalDeletedTx(null);
            }}
            className="text-slate-400 hover:text-white cursor-pointer"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
