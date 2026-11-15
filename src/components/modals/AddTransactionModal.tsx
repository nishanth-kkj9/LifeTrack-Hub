import React, { useEffect, useState } from 'react';
import { X, DollarSign } from 'lucide-react';
import {
  Transaction,
  TransactionType,
  FinanceCategory,
  FinancePaymentMethod,
} from '../../types/index.ts';
import { getLocalDateString } from '../../lib/dateUtils.ts';
import { useModalFocus } from '../../hooks/useModalFocus.ts';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  getLastPaymentMethod,
  saveLastPaymentMethod,
} from '../../lib/financeCategories.ts';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransaction: (transaction: Transaction) => void;
  onUpdateTransaction?: (transaction: Transaction) => void;
  initialTransaction?: Transaction | null;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  onAddTransaction,
  onUpdateTransaction,
  initialTransaction = null,
}) => {
  const { containerRef } = useModalFocus<HTMLDivElement>({ isOpen, onClose });
  const isEditing = Boolean(initialTransaction);
  const [type, setType] = useState<TransactionType>('expense');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<FinanceCategory>(EXPENSE_CATEGORIES[0]);
  const [date, setDate] = useState(() => getLocalDateString());
  const [paymentMethod, setPaymentMethod] = useState<FinancePaymentMethod>(() =>
    getLastPaymentMethod()
  );
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (initialTransaction) {
      setType(initialTransaction.type);
      setTitle(initialTransaction.title);
      setAmount(String(initialTransaction.amount));
      setCategory(initialTransaction.category);
      setDate(initialTransaction.date);
      setPaymentMethod(initialTransaction.paymentMethod);
      setNotes(initialTransaction.notes || '');
    } else {
      setType('expense');
      setTitle('');
      setAmount('');
      setCategory(EXPENSE_CATEGORIES[0]);
      setDate(getLocalDateString());
      setPaymentMethod(getLastPaymentMethod());
      setNotes('');
    }
  }, [isOpen, initialTransaction]);

  if (!isOpen) return null;

  const baseCategories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const visibleCategories =
    initialTransaction &&
    initialTransaction.type === type &&
    !baseCategories.includes(initialTransaction.category)
      ? [initialTransaction.category, ...baseCategories]
      : baseCategories;

  const handleTypeChange = (nextType: TransactionType) => {
    if (nextType === type) return;
    setType(nextType);
    const nextList = nextType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
    setCategory(nextList[0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!title.trim() || isNaN(parsedAmount) || parsedAmount <= 0) return;

    saveLastPaymentMethod(paymentMethod);

    if (initialTransaction) {
      const updatedTx: Transaction = {
        ...initialTransaction,
        title: title.trim(),
        amount: parsedAmount,
        type,
        category,
        date,
        paymentMethod,
        notes: notes.trim() || undefined,
      };
      if (onUpdateTransaction) {
        onUpdateTransaction(updatedTx);
      } else {
        onAddTransaction(updatedTx);
      }
      onClose();
      return;
    }

    const tx: Transaction = {
      id: `tx-${crypto.randomUUID()}`,
      title: title.trim(),
      amount: parsedAmount,
      type,
      category,
      date,
      paymentMethod,
      notes: notes.trim() || undefined,
      createdAt: Date.now(),
    };

    onAddTransaction(tx);
    onClose();

    // Reset
    setTitle('');
    setAmount('');
    setNotes('');
  };

  return (
    <div
      id="add-transaction-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-tx-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        id="add-transaction-modal-card"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <h2 id="add-tx-modal-title" className="text-base font-bold text-slate-900">
            {isEditing ? 'Edit Transaction' : 'Log Transaction'}
          </h2>
          <button
            id="close-add-tx-modal-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Type Toggle */}
        <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
          <button
            type="button"
            id="tx-toggle-expense-btn"
            onClick={() => handleTypeChange('expense')}
            className={`py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              type === 'expense'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Expense (-)
          </button>
          <button
            type="button"
            id="tx-toggle-income-btn"
            onClick={() => handleTypeChange('income')}
            className={`py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              type === 'income'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Income (+)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label htmlFor="tx-title-input" className="block text-xs font-bold text-slate-700 mb-1">
              Description / Payee *
            </label>
            <input
              id="tx-title-input"
              type="text"
              required
              placeholder="e.g. Grocery store haul, Tutoring payout"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="tx-amount-input" className="block text-xs font-bold text-slate-700 mb-1">
                Amount (₹) *
              </label>
              <input
                id="tx-amount-input"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
              />
            </div>

            <div>
              <label htmlFor="tx-date-input" className="block text-xs font-bold text-slate-700 mb-1">
                Date
              </label>
              <input
                id="tx-date-input"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="tx-category-select" className="block text-xs font-bold text-slate-700 mb-1">
                Category
              </label>
              <select
                id="tx-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as FinanceCategory)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {visibleCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="tx-method-select" className="block text-xs font-bold text-slate-700 mb-1">
                Payment Method
              </label>
              <select
                id="tx-method-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as FinancePaymentMethod)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="tx-notes-input" className="block text-xs font-bold text-slate-700 mb-1">
              Notes (Optional)
            </label>
            <input
              id="tx-notes-input"
              type="text"
              placeholder="e.g. Split with roomie"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="submit-create-tx-btn"
              className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer shadow-xs"
            >
              {isEditing ? 'Save Changes' : 'Save Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
