import React, { useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Search,
  Trash2,
  Calendar,
  CreditCard,
  PieChart,
  AlertCircle,
  CheckCircle2,
  Sliders,
} from 'lucide-react';
import { Transaction, BudgetSettings, FinanceCategory } from '../../types/index.ts';

interface FinancesViewProps {
  transactions: Transaction[];
  budget: BudgetSettings;
  onAddTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onUpdateBudget: (budget: BudgetSettings) => void;
  onOpenAddTransactionModal: () => void;
}

export const FinancesView: React.FC<FinancesViewProps> = ({
  transactions,
  budget,
  onDeleteTransaction,
  onUpdateBudget,
  onOpenAddTransactionModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState(budget.monthlyBudget.toString());
  const [savingsInput, setSavingsInput] = useState(budget.savingsGoal.toString());

  // Computations
  const totalIncome = transactions
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const totalExpense = transactions
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const netSavings = totalIncome - totalExpense;
  const budgetSpentPercent =
    budget.monthlyBudget > 0 ? Math.min(Math.round((totalExpense / budget.monthlyBudget) * 100), 100) : 0;

  // Category breakdown for expenses
  const expenseByCategory: Record<string, number> = {};
  transactions
    .filter((tx) => tx.type === 'expense')
    .forEach((tx) => {
      expenseByCategory[tx.category] = (expenseByCategory[tx.category] || 0) + tx.amount;
    });

  const sortedCategories = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]);

  const handleSaveBudget = () => {
    const newBudget = parseFloat(budgetInput) || 0;
    const newSavings = parseFloat(savingsInput) || 0;
    onUpdateBudget({ monthlyBudget: newBudget, savingsGoal: newSavings });
    setIsEditingBudget(false);
  };

  // Filtered transactions
  const filteredTransactions = transactions
    .filter((tx) => {
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      if (
        searchTerm &&
        !tx.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !tx.category.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div id="finances-view-container" className="space-y-6 pb-12">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Personal Finances & Budget</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track daily expenses, monitor your monthly budget cap, and analyze spending categories.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="finances-add-tx-btn"
            onClick={onOpenAddTransactionModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Log Transaction</span>
          </button>
        </div>
      </div>

      {/* 4 Financial Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Savings */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Net Cashflow</span>
            <span className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <p className={`text-2xl font-black ${netSavings >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
            ${netSavings.toFixed(2)}
          </p>
          <p className="text-xs text-slate-500 mt-1">Total revenue minus expenses</p>
        </div>

        {/* Total Income */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Income</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-600">+${totalIncome.toFixed(2)}</p>
          <p className="text-xs text-slate-500 mt-1">{transactions.filter((t) => t.type === 'income').length} deposits</p>
        </div>

        {/* Total Expense */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Expenses</span>
            <span className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <TrendingDown className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900">-${totalExpense.toFixed(2)}</p>
          <p className="text-xs text-slate-500 mt-1">{transactions.filter((t) => t.type === 'expense').length} purchases</p>
        </div>

        {/* Monthly Budget */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Monthly Budget</span>
            <button
              id="finances-edit-budget-toggle"
              onClick={() => setIsEditingBudget(!isEditingBudget)}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              {isEditingBudget ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {isEditingBudget ? (
            <div className="space-y-2">
              <input
                id="finances-budget-input"
                type="number"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-1.5 font-bold"
                placeholder="Budget limit ($)"
              />
              <button
                id="finances-budget-save-btn"
                onClick={handleSaveBudget}
                className="w-full py-1 text-xs font-bold bg-slate-900 text-white rounded-lg"
              >
                Save
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-slate-900">${budget.monthlyBudget}</span>
                <span className="text-xs font-bold text-slate-500">{budgetSpentPercent}% used</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-3">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    budgetSpentPercent > 90 ? 'bg-rose-500' : budgetSpentPercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${budgetSpentPercent}%` }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Breakdown & Transactions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Transaction Log */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-base font-bold text-slate-900">Transaction History</h2>

              <div className="flex items-center gap-2">
                {/* Type filter */}
                <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                  <button
                    id="finances-filter-all-btn"
                    onClick={() => setTypeFilter('all')}
                    className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                      typeFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    All
                  </button>
                  <button
                    id="finances-filter-income-btn"
                    onClick={() => setTypeFilter('income')}
                    className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                      typeFilter === 'income' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Income
                  </button>
                  <button
                    id="finances-filter-expense-btn"
                    onClick={() => setTypeFilter('expense')}
                    className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                      typeFilter === 'expense' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Expenses
                  </button>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="finances-search-input"
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 w-32 sm:w-40"
                  />
                </div>
              </div>
            </div>

            {/* List */}
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl">
                <DollarSign className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">No transactions found</p>
                <p className="text-[11px] text-slate-400 mt-1">Log a transaction to see your spending ledger.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    id={`transaction-row-${tx.id}`}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          tx.type === 'income'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : '-'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-xs sm:text-sm text-slate-900 truncate">{tx.title}</p>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span className="font-medium text-slate-600">{tx.category}</span>
                          <span>•</span>
                          <span>{tx.date}</span>
                          <span>•</span>
                          <span>{tx.paymentMethod}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`font-mono text-xs sm:text-sm font-bold ${
                          tx.type === 'income' ? 'text-emerald-600' : 'text-slate-900'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : '-'}${tx.amount.toFixed(2)}
                      </span>

                      <button
                        id={`transaction-delete-${tx.id}`}
                        onClick={() => onDeleteTransaction(tx.id)}
                        className="p-1 text-slate-400 hover:text-rose-500 rounded transition cursor-pointer"
                        title="Delete transaction"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Category Spending Breakdown */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-indigo-600" />
              <span>Expense Categories</span>
            </h2>

            {sortedCategories.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">No expenses recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {sortedCategories.map(([category, amount]) => {
                  const percent = totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0;
                  return (
                    <div key={category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-700 truncate">{category}</span>
                        <span className="text-slate-900 font-mono">${amount.toFixed(2)} ({percent}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-600 h-full rounded-full"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
