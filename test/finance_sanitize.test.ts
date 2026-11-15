import { sanitizeUserAppData, EMPTY_USER_DATA } from '../src/lib/firebase.ts';
import { RecurringTransaction, Transaction } from '../src/types/index.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

function makeBasePayload(overrides: Record<string, unknown> = {}) {
  return {
    ...EMPTY_USER_DATA,
    ...overrides,
  };
}

function runFinanceSanitizeTests() {
  console.log('--- Starting Finance Sanitization Tests ---');

  // 1. budget: { monthlyBudget: 5000 } (missing savingsGoal)
  {
    const { data, repaired } = sanitizeUserAppData(
      makeBasePayload({ budget: { monthlyBudget: 5000 } })
    );
    assert(
      repaired === true &&
        data.budget.monthlyBudget === 5000 &&
        data.budget.savingsGoal === 0,
      `budget {monthlyBudget:5000} repairs missing savingsGoal to 0 and flags repaired=true`
    );
  }

  // 2. budget: null (and non-object / invalid numbers)
  {
    const nullRes = sanitizeUserAppData(makeBasePayload({ budget: null }));
    assert(
      nullRes.repaired === true &&
        nullRes.data.budget.monthlyBudget === 0 &&
        nullRes.data.budget.savingsGoal === 0,
      'budget null defaults to { monthlyBudget: 0, savingsGoal: 0 } with repaired=true'
    );

    const negNanRes = sanitizeUserAppData(
      makeBasePayload({ budget: { monthlyBudget: -100, savingsGoal: Number.NaN } })
    );
    assert(
      negNanRes.repaired === true &&
        negNanRes.data.budget.monthlyBudget === 0 &&
        negNanRes.data.budget.savingsGoal === 0,
      'negative/NaN budget fields default to 0 with repaired=true'
    );

    const arrRes = sanitizeUserAppData(makeBasePayload({ budget: [5000, 1000] }));
    assert(
      arrRes.repaired === true &&
        arrRes.data.budget.monthlyBudget === 0 &&
        arrRes.data.budget.savingsGoal === 0,
      'array budget defaults to { monthlyBudget: 0, savingsGoal: 0 } with repaired=true'
    );
  }

  // 3. tx without date -> dropped, repaired = true
  {
    const { data, repaired } = sanitizeUserAppData(
      makeBasePayload({
        transactions: [
          {
            id: 'tx-no-date',
            title: 'Lunch',
            amount: 120,
            type: 'expense',
            category: 'Food & Dining',
            paymentMethod: 'Card',
            createdAt: 1700000000000,
          },
          {
            id: 'tx-bad-date',
            title: 'Dinner',
            amount: 200,
            type: 'expense',
            date: '14-11-2026',
            category: 'Food & Dining',
            paymentMethod: 'Card',
            createdAt: 1700000000000,
          },
        ],
      })
    );
    assert(
      repaired === true && data.transactions.length === 0,
      'tx without date or with non-YYYY-MM-DD date is dropped and sets repaired=true'
    );
  }

  // 4. tx amount NaN -> dropped, repaired = true
  {
    const { data, repaired } = sanitizeUserAppData(
      makeBasePayload({
        transactions: [
          {
            id: 'tx-nan',
            title: 'Coffee',
            amount: Number.NaN,
            type: 'expense',
            date: '2026-11-14',
            category: 'Food & Dining',
            paymentMethod: 'Card',
            createdAt: 1700000000000,
          },
        ],
      })
    );
    assert(
      repaired === true && data.transactions.length === 0,
      'tx with amount NaN is dropped and sets repaired=true'
    );
  }

  // 5. tx amount -5 (and 0 / empty id / bad type) -> dropped, repaired = true
  {
    const { data, repaired } = sanitizeUserAppData(
      makeBasePayload({
        transactions: [
          {
            id: 'tx-neg',
            title: 'Refund bug',
            amount: -5,
            type: 'expense',
            date: '2026-11-14',
          },
          {
            id: 'tx-zero',
            title: 'Zero item',
            amount: 0,
            type: 'expense',
            date: '2026-11-14',
          },
          {
            id: '',
            title: 'Empty ID',
            amount: 100,
            type: 'expense',
            date: '2026-11-14',
          },
          {
            id: 'tx-bad-type',
            title: 'Transfer',
            amount: 100,
            type: 'transfer',
            date: '2026-11-14',
          },
        ],
      })
    );
    assert(
      repaired === true && data.transactions.length === 0,
      'tx with amount -5, 0, empty id, or invalid type is dropped and sets repaired=true'
    );
  }

  // 6. Repair missing category, paymentMethod, and createdAt instead of dropping
  {
    const before = Date.now();
    const { data, repaired } = sanitizeUserAppData(
      makeBasePayload({
        transactions: [
          {
            id: 'tx-repair',
            title: 'Bus Pass',
            amount: 350,
            type: 'expense',
            date: '2026-11-14',
          },
        ],
      })
    );
    const after = Date.now();
    const tx = data.transactions[0];
    assert(
      repaired === true &&
        data.transactions.length === 1 &&
        tx.category === 'Other' &&
        tx.paymentMethod === 'Other' &&
        typeof tx.createdAt === 'number' &&
        tx.createdAt >= before &&
        tx.createdAt <= after,
      'tx missing category, paymentMethod, createdAt is repaired instead of dropped with repaired=true'
    );
  }

  // 7. Valid tx untouched and repaired === false
  {
    const validTx: Transaction = {
      id: 'tx-valid-1',
      title: 'Part-time Stipend',
      amount: 1200,
      type: 'income',
      category: 'Salary & Wages',
      date: '2026-11-14',
      paymentMethod: 'Bank Transfer',
      notes: 'November payout',
      createdAt: 1700000000000,
      updatedAt: 1700000005000,
    };
    const { data, repaired } = sanitizeUserAppData(
      makeBasePayload({
        transactions: [validTx],
        budget: { monthlyBudget: 5000, savingsGoal: 1500 },
      })
    );
    assert(
      repaired === false &&
        data.transactions.length === 1 &&
        JSON.stringify(data.transactions[0]) === JSON.stringify(validTx) &&
        data.budget.monthlyBudget === 5000 &&
        data.budget.savingsGoal === 1500,
      'valid tx and valid budget remain untouched with repaired=false'
    );
  }

  // 8. UPI, new FinanceCategory values, and legacy 'Online Wallet' remain valid with repaired === false
  {
    const upiTx: Transaction = {
      id: 'tx-upi-1',
      title: 'Spotify Student',
      amount: 59,
      type: 'expense',
      category: 'Subscriptions',
      date: '2026-11-15',
      paymentMethod: 'UPI',
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    };
    const walletTx: Transaction = {
      id: 'tx-wallet-legacy',
      title: 'Metro Recharge',
      amount: 200,
      type: 'expense',
      category: 'Travel',
      date: '2026-11-14',
      paymentMethod: 'Online Wallet',
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    };
    const { data, repaired } = sanitizeUserAppData(
      makeBasePayload({
        transactions: [upiTx, walletTx],
        budget: { monthlyBudget: 5000, savingsGoal: 1500 },
      })
    );
    assert(
      repaired === false &&
        data.transactions.length === 2 &&
        data.transactions[0].paymentMethod === 'UPI' &&
        data.transactions[0].category === 'Subscriptions' &&
        data.transactions[1].paymentMethod === 'Online Wallet' &&
        data.transactions[1].category === 'Travel',
      'UPI, new expense categories, and legacy Online Wallet transactions remain valid without migration (repaired=false)'
    );
  }

  // 9. Valid categoryBudgets and rollover remain intact with repaired === false
  {
    const { data, repaired } = sanitizeUserAppData(
      makeBasePayload({
        budget: {
          monthlyBudget: 6000,
          savingsGoal: 1200,
          categoryBudgets: { 'Food & Dining': 2000, Travel: 0 },
          rollover: true,
        },
      })
    );
    assert(
      repaired === false &&
        data.budget.categoryBudgets?.['Food & Dining'] === 2000 &&
        data.budget.categoryBudgets?.Travel === 0 &&
        data.budget.rollover === true,
      'valid categoryBudgets (>= 0) and boolean rollover remain intact with repaired=false'
    );
  }

  // 10. Invalid categoryBudgets entries and non-boolean rollover are repaired cleanly
  {
    const { data, repaired } = sanitizeUserAppData(
      makeBasePayload({
        budget: {
          monthlyBudget: 6000,
          savingsGoal: 1200,
          categoryBudgets: {
            'Food & Dining': 1800,
            Travel: -50,
            Subscriptions: Number.NaN,
            Entertainment: Number.POSITIVE_INFINITY,
            Other: '500',
          },
          rollover: 'yes',
        },
      })
    );
    assert(
      repaired === true &&
        data.budget.categoryBudgets?.['Food & Dining'] === 1800 &&
        data.budget.categoryBudgets?.Travel === undefined &&
        data.budget.categoryBudgets?.Subscriptions === undefined &&
        data.budget.categoryBudgets?.Entertainment === undefined &&
        data.budget.categoryBudgets?.Other === undefined &&
        data.budget.rollover === undefined,
      'negative, NaN, Infinity, or non-number categoryBudgets entries and non-boolean rollover are dropped with repaired=true'
    );

    const nonObjRes = sanitizeUserAppData(
      makeBasePayload({
        budget: {
          monthlyBudget: 4000,
          savingsGoal: 500,
          categoryBudgets: ['bad'],
          rollover: false,
        },
      })
    );
    assert(
      nonObjRes.repaired === true &&
        nonObjRes.data.budget.categoryBudgets === undefined &&
        nonObjRes.data.budget.rollover === false,
      'non-object categoryBudgets array is dropped with repaired=true while boolean rollover is kept'
    );
  }

  // 11. Valid recurringTransactions (including tombstoned item) preserved with repaired === false
  {
    const recMonthly: RecurringTransaction = {
      id: 'rec-rent',
      title: 'Hostel Rent',
      amount: 6500,
      type: 'expense',
      category: 'Housing & Rent',
      paymentMethod: 'Bank Transfer',
      frequency: 'monthly',
      dayOfMonth: 31,
      startDate: '2026-01-31',
      endDate: '2026-12-31',
      lastGeneratedOn: '2026-10-31',
      createdAt: 1700000000000,
      updatedAt: 1700000001000,
    };
    const recTombstone: RecurringTransaction = {
      id: 'rec-old',
      title: 'Old Gym',
      amount: 800,
      type: 'expense',
      category: 'Health & Wellness',
      paymentMethod: 'UPI',
      frequency: 'weekly',
      startDate: '2026-01-01',
      updatedAt: 1700000002000,
      deletedAt: 1700000002000,
    };
    const { data, repaired } = sanitizeUserAppData(
      makeBasePayload({
        recurringTransactions: [recMonthly, recTombstone],
      })
    );
    assert(
      repaired === false &&
        data.recurringTransactions?.length === 2 &&
        data.recurringTransactions[0].dayOfMonth === 31 &&
        data.recurringTransactions[0].lastGeneratedOn === '2026-10-31' &&
        data.recurringTransactions[1].deletedAt === 1700000002000,
      'valid recurringTransactions and tombstones stay intact with repaired=false'
    );
  }

  // 12. Malformed recurringTransactions repaired or dropped cleanly
  {
    const { data, repaired } = sanitizeUserAppData(
      makeBasePayload({
        recurringTransactions: [
          {
            id: 'rec-repairable',
            title: 'Internet Plan',
            amount: 799,
            type: 'expense',
            frequency: 'monthly',
            dayOfMonth: 45, // invalid -> dropped
            startDate: '2026-10-01',
            endDate: 'bad-date', // invalid -> dropped
          },
          {
            id: 'rec-bad-freq',
            title: 'Yearly',
            amount: 1000,
            type: 'expense',
            frequency: 'yearly',
            startDate: '2026-01-01',
          },
          {
            id: 'rec-bad-amt',
            title: 'Zero',
            amount: 0,
            type: 'expense',
            frequency: 'weekly',
            startDate: '2026-01-01',
          },
        ],
      })
    );
    const repairedItem = data.recurringTransactions?.[0];
    assert(
      repaired === true &&
        data.recurringTransactions?.length === 1 &&
        repairedItem?.category === 'Other' &&
        repairedItem?.paymentMethod === 'Other' &&
        repairedItem?.dayOfMonth === undefined &&
        repairedItem?.endDate === undefined &&
        repairedItem?.updatedAt === 0,
      'recurringTransactions repairs missing category/paymentMethod, drops bad dayOfMonth/endDate, and drops invalid items'
    );
  }

  console.log('--- All Finance Sanitization Tests Passed! ---');
}

runFinanceSanitizeTests();


