import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import type { Task, Transaction, ExamReminder } from '../src/types/index.ts';
import { getLocalDateOffset, getLocalDateString } from '../src/lib/dateUtils.ts';

const dom = new JSDOM(
  '<!DOCTYPE html><html><head><title>Insights Summary Cards Test</title></head><body><div id="root"></div></body></html>',
  {
    url: 'http://localhost:3000',
    pretendToBeVisual: true,
  }
);

Object.defineProperty(globalThis, 'window', { value: dom.window, writable: true, configurable: true });
Object.defineProperty(globalThis, 'document', { value: dom.window.document, writable: true, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
Object.defineProperty(globalThis, 'HTMLElement', { value: dom.window.HTMLElement, writable: true, configurable: true });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runInsightsSummaryCardsTests() {
  console.log('--- Starting Insights Summary Cards (Budget, Task, Exam) Tests ---');
  const { InsightsView } = await import('../src/components/views/InsightsView.tsx');

  const today = new Date();
  const todayStr = getLocalDateString(today);
  const prevMonthDate = getLocalDateString(new Date(today.getFullYear(), today.getMonth() - 1, 15));
  const nowMs = Date.now();

  const container = document.getElementById('root')!;
  const root: Root = createRoot(container);

  // 1. Rich seed budget values: budget 15000, spent 20000 this month (+ previous month tx ignored for monthly period)
  const overBudgetTransactions: Transaction[] = [
    {
      id: 'tx-this-month-1',
      title: 'Rent & Hostel',
      amount: 14000,
      type: 'expense',
      category: 'Housing & Rent',
      date: todayStr,
      paymentMethod: 'Bank Transfer',
      createdAt: nowMs - 1000,
    },
    {
      id: 'tx-this-month-2',
      title: 'Books & Mess',
      amount: 6000,
      type: 'expense',
      category: 'Food & Dining',
      date: todayStr,
      paymentMethod: 'UPI',
      createdAt: nowMs - 500,
    },
    {
      id: 'tx-prev-month-income',
      title: 'Last Month Stipend',
      amount: 50000,
      type: 'income',
      category: 'Allowance & Grants',
      date: prevMonthDate,
      paymentMethod: 'Bank Transfer',
      createdAt: nowMs - 86400000 * 30,
    },
    {
      id: 'tx-deleted',
      title: 'Deleted Refund',
      amount: 10000,
      type: 'income',
      category: 'Other',
      date: todayStr,
      paymentMethod: 'Cash',
      createdAt: nowMs - 200,
      deletedAt: nowMs,
    },
  ];

  // Tasks covering 7d, 30d, All time via completedAt + overdue
  const tasksFixture: Task[] = [
    {
      id: 't-comp-2d',
      title: 'Completed 2 days ago',
      category: 'study',
      priority: 'high',
      dueDate: getLocalDateOffset(-2, today),
      completed: true,
      completedAt: nowMs - 2 * 24 * 60 * 60 * 1000,
      subtasks: [],
      createdAt: nowMs - 5 * 24 * 60 * 60 * 1000,
    },
    {
      id: 't-comp-15d',
      title: 'Completed 15 days ago',
      category: 'work',
      priority: 'medium',
      dueDate: getLocalDateOffset(-15, today),
      completed: true,
      completedAt: nowMs - 15 * 24 * 60 * 60 * 1000,
      subtasks: [],
      createdAt: nowMs - 20 * 24 * 60 * 60 * 1000,
    },
    {
      id: 't-comp-60d',
      title: 'Completed 60 days ago',
      category: 'personal',
      priority: 'low',
      dueDate: getLocalDateOffset(-60, today),
      completed: true,
      completedAt: nowMs - 60 * 24 * 60 * 60 * 1000,
      subtasks: [],
      createdAt: nowMs - 70 * 24 * 60 * 60 * 1000,
    },
    {
      id: 't-overdue-1',
      title: 'Overdue lab report',
      category: 'study',
      priority: 'urgent',
      dueDate: getLocalDateOffset(-3, today),
      completed: false,
      subtasks: [],
      createdAt: nowMs - 4 * 24 * 60 * 60 * 1000,
    },
    {
      id: 't-overdue-2',
      title: 'Overdue quiz prep',
      category: 'study',
      priority: 'high',
      dueDate: getLocalDateOffset(-1, today),
      completed: false,
      subtasks: [],
      createdAt: nowMs - 3 * 24 * 60 * 60 * 1000,
    },
    {
      id: 't-deleted',
      title: 'Deleted completed task',
      category: 'other',
      priority: 'low',
      dueDate: todayStr,
      completed: true,
      completedAt: nowMs - 1000,
      subtasks: [],
      createdAt: nowMs - 2000,
      deletedAt: nowMs,
    },
  ];

  // Exams: one past, two future (earliest 4 days away, later 12 days away), one deleted earlier
  const examsFixture: ExamReminder[] = [
    {
      id: 'ex-past',
      subject: 'Past Chemistry',
      examDate: getLocalDateOffset(-4, today),
      examTime: '09:30',
      status: 'ready',
      topics: [],
      createdAt: nowMs - 100000,
    },
    {
      id: 'ex-deleted',
      subject: 'Deleted Physics',
      examDate: getLocalDateOffset(2, today),
      examTime: '09:30',
      status: 'studying',
      topics: [],
      createdAt: nowMs - 100000,
      deletedAt: nowMs,
    },
    {
      id: 'ex-later',
      subject: 'Operating Systems',
      examDate: getLocalDateOffset(12, today),
      examTime: '14:00',
      status: 'not_started',
      topics: [],
      createdAt: nowMs - 100000,
    },
    {
      id: 'ex-next',
      subject: 'Discrete Mathematics',
      examDate: getLocalDateOffset(4, today),
      examTime: '09:30',
      status: 'studying',
      topics: [],
      createdAt: nowMs - 100000,
    },
  ];

  await act(async () => {
    root.render(
      React.createElement(InsightsView, {
        tasks: tasksFixture,
        habits: [],
        transactions: overBudgetTransactions,
        budget: { monthlyBudget: 15000, savingsGoal: 5000 },
        exams: examsFixture,
      })
    );
  });

  const textOver = container.textContent || '';
  assert(
    textOver.includes('133%') &&
      textOver.includes('Over budget by ₹5,000') &&
      textOver.includes('-₹20,000 net this month') &&
      !textOver.includes('30,000'),
    'Budget 15000 with spent 20000 shows 133%, "Over budget by ₹5,000", and monthly net -₹20,000 (ignoring previous month income)'
  );

  // Verify rose styling is present on Over budget by text
  const overBudgetEl = Array.from(container.querySelectorAll('p, span')).find((el) =>
    (el.textContent || '').includes('Over budget by ₹5,000')
  );
  assert(
    Boolean(overBudgetEl && overBudgetEl.className.includes('text-rose-')),
    '"Over budget by ₹5,000" uses explicit rose text styling'
  );

  // Reflection parity check: uses same over-budget value, no separate 80% discrepancy
  assert(
    textOver.includes('Note: Over budget by ₹5,000 (133% used).') &&
      !textOver.includes('over 80% utilized'),
    'Weekly reflection uses exact same over-budget figure (133%, Over budget by ₹5,000)'
  );

  // Task tile checks across ranges: 7d -> 1 completed, 30d -> 2 completed, All time -> 3 completed, always 2 overdue
  assert(
    textOver.includes('1 completed in last 7 days') && textOver.includes('2 overdue'),
    '7-day range Task tile shows "1 completed in last 7 days" (using completedAt) and "2 overdue"'
  );

  await act(async () => {
    document.getElementById('insights-range-30')?.click();
  });
  const text30 = container.textContent || '';
  assert(
    text30.includes('2 completed in last 30 days') && text30.includes('2 overdue'),
    '30-day range Task tile updates to "2 completed in last 30 days" and "2 overdue"'
  );

  await act(async () => {
    document.getElementById('insights-range-all')?.click();
  });
  const textAll = container.textContent || '';
  assert(
    textAll.includes('3 completed across all time') && textAll.includes('2 overdue'),
    'All-time range Task tile updates to "3 completed across all time" and "2 overdue"'
  );

  // Academic tile checks: next exam name + days left (no static "Exam dates synchronized")
  assert(
    textOver.includes('Discrete Mathematics · 4 days left') &&
      !textOver.includes('Exam dates synchronized'),
    'Academic tile displays earliest active upcoming exam name and days left ("Discrete Mathematics · 4 days left")'
  );

  // 2. Zero budget + no upcoming exams state
  await act(async () => {
    root.render(
      React.createElement(InsightsView, {
        tasks: [],
        habits: [],
        transactions: overBudgetTransactions,
        budget: { monthlyBudget: 0, savingsGoal: 0 },
        exams: [examsFixture[0], examsFixture[1]], // only past & deleted
      })
    );
  });

  const textZero = container.textContent || '';
  const budgetCardEl = Array.from(container.querySelectorAll('div')).find(
    (el) =>
      el.className.includes('rounded-2xl') &&
      (el.textContent || '').includes('Budget Health') &&
      (el.textContent || '').includes('net this month')
  );
  const budgetCardText = budgetCardEl?.textContent || '';
  assert(
    Boolean(budgetCardEl) &&
      budgetCardText.includes('No budget set') &&
      !budgetCardText.includes('0%') &&
      !textZero.includes('Over budget') &&
      !textZero.includes('monthly budget is'),
    'monthlyBudget 0 renders "No budget set" instead of 0% in Budget Health card and emits no budget warning in reflection'
  );

  assert(
    textZero.includes('No upcoming exams') && !textZero.includes('Exam dates synchronized'),
    'Empty/past-only exams render "No upcoming exams"'
  );

  await act(async () => {
    root.unmount();
  });

  console.log('--- All Insights Summary Cards Tests Passed! ---');
}

await runInsightsSummaryCardsTests();
