import {
  monthKey,
  shiftMonthKey,
  summarizeMonth,
  summarizeAllTime,
  budgetStatus,
  categoryAvailable,
  groupByDate,
  formatTxDate,
} from '../src/lib/financeUtils.ts';
import {
  enumerateRecurringOccurrences,
  generateMissingRecurringTransactions,
  getUpcomingBills,
} from '../src/lib/recurringTransactions.ts';
import { RecurringTransaction, Transaction } from '../src/types/index.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-default',
    title: 'Sample Transaction',
    amount: 100,
    type: 'expense',
    category: 'Food & Dining',
    date: '2026-11-10',
    paymentMethod: 'Card',
    createdAt: 1700000000000,
    ...overrides,
  };
}

function runFinanceUtilsTests() {
  console.log('--- Starting Finance Utils Tests ---');
  const todayStr = '2026-11-15';

  // 1. Seeded example: Nov expenses 349.50 + 2400.10 + 3200.20 vs 5000 => percent 119, remaining -949.80, over true
  {
    const txs: Transaction[] = [
      makeTx({ id: 'tx-1', amount: 349.50, date: '2026-11-05', category: 'Food & Dining' }),
      makeTx({ id: 'tx-2', amount: 2400.10, date: '2026-11-10', category: 'Books & Supplies' }),
      makeTx({ id: 'tx-3', amount: 3200.20, date: '2026-11-14', category: 'Tuition & Education' }),
      makeTx({ id: 'tx-inc', amount: 10000, type: 'income', date: '2026-11-01', category: 'Salary & Wages' }),
      // Softly deleted item must be ignored
      makeTx({ id: 'tx-del', amount: 9999, date: '2026-11-12', deletedAt: 1700000001000 }),
    ];

    const summary = summarizeMonth(txs, '2026-11', todayStr);
    assert(
      summary.expense === 5949.8 &&
        summary.income === 10000 &&
        summary.net === 4050.2 &&
        summary.count === 4,
      `Nov seeded summary sums 5949.80 expense, 10000 income, 4050.20 net, count 4 (got expense=${summary.expense})`
    );

    const status = budgetStatus(summary.expense, 5000);
    assert(
      status.percent === 119 &&
        status.remaining === -949.8 &&
        status.over === true &&
        status.level === 'over',
      `budgetStatus(5949.80, 5000) returns percent=119, remaining=-949.8, over=true, level='over' (got ${JSON.stringify(status)})`
    );
  }

  // 2. Future-dated expense excluded from month/all-time totals, but grouped under "Upcoming"
  {
    const txs: Transaction[] = [
      makeTx({ id: 'tx-today', title: 'Today Lunch', amount: 250, date: '2026-11-15' }),
      makeTx({ id: 'tx-yest', title: 'Yesterday Metro', amount: 60, date: '2026-11-14' }),
      makeTx({ id: 'tx-older', title: 'Older Books', amount: 400, date: '2026-11-02' }),
      makeTx({ id: 'tx-future', title: 'Future Rent', amount: 8000, date: '2026-11-28' }),
    ];

    const novSummary = summarizeMonth(txs, '2026-11', todayStr);
    const allSummary = summarizeAllTime(txs, todayStr);
    assert(
      novSummary.expense === 710 && novSummary.count === 3 && allSummary.expense === 710,
      `Future-dated expense (2026-11-28) is excluded from month and all-time totals (got ${novSummary.expense})`
    );

    const groups = groupByDate(txs, todayStr);
    assert(
      formatTxDate('2026-11-12') === '12 Nov 2026' &&
        groups.map((g) => g.label).join('|') ===
          `Upcoming|Today|Yesterday|${formatTxDate('2026-11-02')}`,
      `groupByDate produces Upcoming, Today, Yesterday, and "12 Nov 2026"-style formatted date header (got ${groups.map((g) => g.label).join('|')})`
    );
    assert(
      groups[0].items[0].id === 'tx-future',
      'Upcoming group holds the future-dated transaction'
    );
  }

  // 3. Month with no data
  {
    const txs: Transaction[] = [
      makeTx({ id: 'tx-nov', amount: 500, date: '2026-11-10' }),
    ];
    const emptyMonth = summarizeMonth(txs, '2026-08', todayStr);
    assert(
      emptyMonth.income === 0 &&
        emptyMonth.expense === 0 &&
        emptyMonth.net === 0 &&
        emptyMonth.count === 0 &&
        Object.keys(emptyMonth.expenseByCategory).length === 0,
      'Month with no data returns zero totals and empty expenseByCategory'
    );
  }

  // 4. Dec -> Jan key handling & Jan -> Dec backwards shift
  {
    assert(
      monthKey('2026-12-31') === '2026-12' &&
        shiftMonthKey('2026-12', 1) === '2027-01' &&
        shiftMonthKey('2027-01', -1) === '2026-12' &&
        monthKey('2027-01-01') === '2027-01',
      'Dec->Jan and Jan->Dec month key wrapping resolves 2026-12 <-> 2027-01 cleanly'
    );
  }

  // 5. budgetStatus threshold levels: ok (<70), warn (>=70), danger (>=90), over (>100)
  {
    const ok = budgetStatus(3400, 5000); // 68%
    const warn = budgetStatus(3500, 5000); // 70%
    const danger = budgetStatus(4500, 5000); // 90%
    const atCap = budgetStatus(5000, 5000); // 100%
    const over = budgetStatus(5050, 5000); // 101%

    assert(
      ok.level === 'ok' && ok.percent === 68 && !ok.over &&
        warn.level === 'warn' && warn.percent === 70 && !warn.over &&
        danger.level === 'danger' && danger.percent === 90 && !danger.over &&
        atCap.level === 'danger' && atCap.percent === 100 && atCap.remaining === 0 && !atCap.over &&
        over.level === 'over' && over.percent === 101 && over.over && over.remaining === -50,
      'budgetStatus classifies ok (<70), warn (>=70), danger (>=90..100), and over (>100) accurately'
    );
  }

  // 6. categoryAvailable rollover tests (unspent +300, overspent -100, rollover off, missing limit)
  {
    const unspentCarry = categoryAvailable(
      { limit: 1000, spent: 700 },
      { limit: 1000, spent: 200 },
      true
    );
    const overspentCarry = categoryAvailable(
      { limit: 1000, spent: 1100 },
      { limit: 1000, spent: 200 },
      true
    );
    const rolloverOff = categoryAvailable(
      { limit: 1000, spent: 700 },
      { limit: 1000, spent: 200 },
      false
    );
    const noLimit = categoryAvailable(
      { limit: 1000, spent: 700 },
      { limit: undefined, spent: 200 },
      true
    );

    assert(
      unspentCarry === 1300 &&
        overspentCarry === 900 &&
        rolloverOff === 1000 &&
        noLimit === undefined,
      `categoryAvailable handles unspent +300 (1300), overspent -100 (900), rollover=false (1000), and missing limit (undefined) (got ${unspentCarry}, ${overspentCarry}, ${rolloverOff}, ${noLimit})`
    );
  }

  // 7. Monthly recurring on day 31 across February (non-leap & leap years)
  {
    const nonLeapMonthly: RecurringTransaction = {
      id: 'rec-31-nonleap',
      title: 'Month-End Rent',
      amount: 7000,
      type: 'expense',
      category: 'Housing & Rent',
      paymentMethod: 'Bank Transfer',
      frequency: 'monthly',
      dayOfMonth: 31,
      startDate: '2026-01-31',
    };
    const nonLeapDates = enumerateRecurringOccurrences(nonLeapMonthly, '2026-04-30');
    assert(
      nonLeapDates.join(',') === '2026-01-31,2026-02-28,2026-03-31,2026-04-30',
      `Monthly day 31 across non-leap Feb clamps to Feb 28 and restores Mar 31 / Apr 30 (got ${nonLeapDates.join(',')})`
    );

    const leapMonthly: RecurringTransaction = {
      ...nonLeapMonthly,
      id: 'rec-31-leap',
      startDate: '2024-01-31',
    };
    const leapDates = enumerateRecurringOccurrences(leapMonthly, '2024-03-31');
    assert(
      leapDates.join(',') === '2024-01-31,2024-02-29,2024-03-31',
      `Monthly day 31 across leap Feb 2024 clamps to Feb 29 and restores Mar 31 (got ${leapDates.join(',')})`
    );
  }

  // 8. Idempotent generation using lastGeneratedOn & deterministic IDs (no duplicates)
  {
    const schedule: RecurringTransaction = {
      id: 'rec-idem',
      title: 'Music Sub',
      amount: 119,
      type: 'expense',
      category: 'Subscriptions',
      paymentMethod: 'UPI',
      frequency: 'monthly',
      dayOfMonth: 31,
      startDate: '2026-01-31',
    };

    const run1 = generateMissingRecurringTransactions(
      { transactions: [], recurringTransactions: [schedule] },
      '2026-03-31',
      1700000001000
    );
    assert(
      run1.changed === true &&
        run1.generated.length === 3 &&
        run1.transactions.length === 3 &&
        run1.generated.map((t) => t.date).join(',') === '2026-01-31,2026-02-28,2026-03-31' &&
        run1.recurringTransactions[0].lastGeneratedOn === '2026-03-31',
      'First run generates Jan 31, Feb 28, Mar 31 and updates lastGeneratedOn to 2026-03-31'
    );

    // Second run on same date must be completely idempotent
    const run2 = generateMissingRecurringTransactions(
      {
        transactions: run1.transactions,
        recurringTransactions: run1.recurringTransactions,
      },
      '2026-03-31',
      1700000002000
    );
    assert(
      run2.changed === false &&
        run2.generated.length === 0 &&
        run2.transactions.length === 3,
      'Second run on same date is idempotent (changed=false, zero duplicates)'
    );

    // Even if lastGeneratedOn was missing/stale on a schedule, existing transaction ID prevents duplicate
    const staleSchedule: RecurringTransaction = { ...schedule };
    const run3 = generateMissingRecurringTransactions(
      {
        transactions: run1.transactions,
        recurringTransactions: [staleSchedule],
      },
      '2026-03-31',
      1700000003000
    );
    assert(
      run3.generated.length === 0 && run3.transactions.length === 3,
      'Stale/missing lastGeneratedOn still creates zero duplicate transactions'
    );
  }

  // 9. Ended schedule stops generating and is omitted from Upcoming bills (next 30 days)
  {
    const endedSchedule: RecurringTransaction = {
      id: 'rec-ended',
      title: 'Semester Gym Pass',
      amount: 600,
      type: 'expense',
      category: 'Health & Wellness',
      paymentMethod: 'Card',
      frequency: 'monthly',
      dayOfMonth: 15,
      startDate: '2026-01-15',
      endDate: '2026-02-20',
    };
    const activeUpcomingSchedule: RecurringTransaction = {
      id: 'rec-wifi',
      title: 'Fiber WiFi',
      amount: 999,
      type: 'expense',
      category: 'Mobile & Internet',
      paymentMethod: 'UPI',
      frequency: 'weekly',
      startDate: '2026-11-10',
    };
    const tombstonedSchedule: RecurringTransaction = {
      id: 'rec-deleted',
      title: 'Cancelled Stream',
      amount: 499,
      type: 'expense',
      category: 'Subscriptions',
      paymentMethod: 'Card',
      frequency: 'monthly',
      dayOfMonth: 20,
      startDate: '2026-10-20',
      deletedAt: 1700000005000,
    };

    const genEnded = generateMissingRecurringTransactions(
      { transactions: [], recurringTransactions: [endedSchedule] },
      '2026-05-01',
      1700000010000
    );
    assert(
      genEnded.generated.map((t) => t.date).join(',') === '2026-01-15,2026-02-15' &&
        genEnded.recurringTransactions[0].lastGeneratedOn === '2026-02-15',
      `Ended schedule (endDate 2026-02-20) stops at 2026-02-15 when evaluated on 2026-05-01 (got ${genEnded.generated.map((t) => t.date).join(',')})`
    );

    const upcoming = getUpcomingBills(
      [endedSchedule, activeUpcomingSchedule, tombstonedSchedule],
      '2026-11-15',
      30
    );
    assert(
      upcoming.length === 5 &&
        upcoming.every((b) => b.scheduleId === 'rec-wifi') &&
        upcoming.map((b) => b.date).join(',') ===
          '2026-11-17,2026-11-24,2026-12-01,2026-12-08,2026-12-15',
      `getUpcomingBills excludes ended & tombstoned schedules and projects weekly bills in next 30 days (got ${upcoming.map((b) => b.date).join(',')})`
    );
  }

  console.log('--- All Finance Utils Tests Passed! ---');
}

runFinanceUtilsTests();
