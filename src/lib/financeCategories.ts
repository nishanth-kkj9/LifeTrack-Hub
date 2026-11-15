import { FinanceCategory, FinancePaymentMethod } from '../types/index.ts';

export const EXPENSE_CATEGORIES: FinanceCategory[] = [
  'Food & Dining',
  'Groceries',
  'Housing & Rent',
  'Tuition & Education',
  'Books & Supplies',
  'Transportation',
  'Travel',
  'Bills & Utilities',
  'Mobile & Internet',
  'Subscriptions',
  'Entertainment',
  'Shopping',
  'Health & Wellness',
  'Fees & Fines',
  'Other',
];

export const INCOME_CATEGORIES: FinanceCategory[] = [
  'Salary & Wages',
  'Freelance & Gigs',
  'Allowance & Grants',
  'Investments & Savings',
  'Other',
];

export const PAYMENT_METHODS: FinancePaymentMethod[] = [
  'UPI',
  'Card',
  'Cash',
  'Bank Transfer',
  'Online Wallet',
  'Other',
];

export const LAST_PAYMENT_METHOD_KEY = 'lifetrack_last_payment_method';

export function getLastPaymentMethod(): FinancePaymentMethod {
  try {
    const saved =
      typeof localStorage !== 'undefined' ? localStorage.getItem(LAST_PAYMENT_METHOD_KEY) : null;
    if (saved && (PAYMENT_METHODS as string[]).includes(saved)) {
      return saved as FinancePaymentMethod;
    }
  } catch {
    // Ignore localStorage access errors
  }
  return 'Card';
}

export function saveLastPaymentMethod(method: FinancePaymentMethod): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LAST_PAYMENT_METHOD_KEY, method);
    }
  } catch {
    // Ignore localStorage access errors
  }
}
