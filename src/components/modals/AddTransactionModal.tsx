import React, { useState } from 'react';
import { X, DollarSign } from 'lucide-react';
import { Transaction, TransactionType, FinanceCategory } from '../../types/index.ts';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransaction: (transaction: Transaction) => void;
}

const CATEGORIES: FinanceCategory[] = [
  'Food & Dining',
  'Groceries',
  'Housing & Rent',
  'Tuition & Education',
  'Books & Supplies',
  'Transportation',
  'Bills & Utilities',
  'Shopping',
  'Health & Wellness',
  'Salary & Wages',
  'Freelance & Gigs',
  'Allowance & Grants',
  'Investments & Savings',
  'Other',
];

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  onAddTransaction,
}) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<FinanceCategory>('Food & Dining');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<'Card' | 'Cash' | 'Bank Transfer' | 'Online Wallet' | 'Other'>('Card');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!title.trim() || isNaN(parsedAmount) || parsedAmount <= 0) return;

    const tx: Transaction = {
      id: `tx-${Date.now()}`,
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        id="add-transaction-modal-card"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-150">
          <h2 className="text-base font-bold text-slate-900">Log Transaction</h2>
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
            onClick={() => setType('expense')}
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
            onClick={() => setType('income')}
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
                Amount ($) *
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
                {CATEGORIES.map((c) => (
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
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Card">Card</option>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Online Wallet">Online Wallet</option>
                <option value="Other">Other</option>
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

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-150">
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
              Save Transaction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
