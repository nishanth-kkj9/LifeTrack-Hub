import { sanitizeUserAppData, EMPTY_USER_DATA } from '../src/lib/firebase.ts';
import { isDateInVacation } from '../src/lib/habitScoring.ts';
import { exportHabitsCsv } from '../src/lib/dataExport.ts';
import { Habit } from '../src/types/index.ts';

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

function runHabitSanitizeTests() {
  console.log('--- Starting Habit Sanitization & CSV Export Tests ---');

  // 1. { vacationPeriods: {} } is repaired cleanly and isDateInVacation tolerates non-arrays
  {
    const { data, repaired } = sanitizeUserAppData(
      makeBasePayload({
        habits: [
          {
            id: 'h-vac-obj',
            name: 'Morning Run',
            targetDaysPerWeek: 5,
            completedDates: ['2026-11-01'],
            streak: 1,
            bestStreak: 2,
            createdAt: 1700000000000,
            updatedAt: 1700000000000,
            vacationPeriods: {},
          },
        ],
      })
    );
    assert(
      repaired === true &&
        data.habits.length === 1 &&
        Array.isArray(data.habits[0].vacationPeriods) &&
        data.habits[0].vacationPeriods.length === 0,
      'habit with { vacationPeriods: {} } repairs to [] and sets repaired=true'
    );

    assert(
      isDateInVacation('2026-11-16', {} as any) === false &&
        isDateInVacation('2026-11-16', null as any) === false &&
        isDateInVacation('2026-11-16', [null as any, { startDate: '2026-11-10', endDate: '2026-11-20', id: 'v1' }]) === true,
      'isDateInVacation tolerates non-arrays and malformed entries without throwing'
    );
  }

  // 2. completedDates [null, 5, '2026-11-01'] keeps only valid YYYY-MM-DD strings
  {
    const { data, repaired } = sanitizeUserAppData(
      makeBasePayload({
        habits: [
          {
            id: 'h-dates',
            name: 'Hydrate',
            targetDaysPerWeek: 7,
            completedDates: [null, 5, '2026-11-01', '2026-02-30', 'bad-date'],
            streak: 1,
            bestStreak: 1,
            createdAt: 1700000000000,
            updatedAt: 1700000000000,
          },
        ],
      })
    );
    assert(
      repaired === true &&
        data.habits.length === 1 &&
        data.habits[0].completedDates.length === 1 &&
        data.habits[0].completedDates[0] === '2026-11-01',
      "completedDates [null, 5, '2026-11-01', invalid] keeps only ['2026-11-01'] with repaired=true"
    );
  }

  // 3. Missing name / createdAt are coerced with defaults ('Habit' and finite Date.now())
  {
    const before = Date.now();
    const { data, repaired } = sanitizeUserAppData(
      makeBasePayload({
        habits: [
          {
            id: 'h-missing-name-created',
            targetDaysPerWeek: 4,
            completedDates: [],
            streak: 0,
            bestStreak: 0,
            updatedAt: 1700000000000,
          },
          {
            id: 'h-nonstring-name-bad-created',
            name: 42,
            targetDaysPerWeek: 3,
            completedDates: [],
            streak: 0,
            bestStreak: 0,
            createdAt: Number.NaN,
          },
        ],
      })
    );
    const after = Date.now();
    assert(
      repaired === true &&
        data.habits.length === 2 &&
        data.habits[0].name === 'Habit' &&
        typeof data.habits[0].createdAt === 'number' &&
        Number.isFinite(data.habits[0].createdAt) &&
        data.habits[0].createdAt >= before &&
        data.habits[0].createdAt <= after &&
        data.habits[1].name === 'Habit' &&
        typeof data.habits[1].createdAt === 'number' &&
        Number.isFinite(data.habits[1].createdAt),
      'missing/invalid name and createdAt coerce to "Habit" and finite timestamp with repaired=true'
    );
  }

  // 4. Empty/non-string id dropped; targetDaysPerWeek, category, customDays, vacationPeriods, scheduleType validated
  {
    const { data, repaired } = sanitizeUserAppData(
      makeBasePayload({
        habits: [
          { id: '', name: 'Empty ID', targetDaysPerWeek: 7, completedDates: [], streak: 0, bestStreak: 0, createdAt: 1 },
          { id: '   ', name: 'Whitespace ID', targetDaysPerWeek: 7, completedDates: [], streak: 0, bestStreak: 0, createdAt: 1 },
          { id: 123, name: 'Numeric ID', targetDaysPerWeek: 7, completedDates: [], streak: 0, bestStreak: 0, createdAt: 1 },
          {
            id: 'h-fields',
            name: 'Study DSA',
            category: 999,
            targetDaysPerWeek: 9,
            completedDates: ['2026-11-10'],
            customDays: [-1, 0, 3, 6, 7, 2.5, '1'],
            vacationPeriods: [
              { id: 'v-ok', startDate: '2026-11-01', endDate: '2026-11-05' },
              { id: 'v-reversed', startDate: '2026-11-10', endDate: '2026-11-05' },
              { id: 'v-bad-date', startDate: '2026-02-31', endDate: '2026-03-01' },
              { id: '', startDate: '2026-11-01', endDate: '2026-11-02' },
            ],
            scheduleType: 'hourly',
            streak: 2,
            bestStreak: 4,
            createdAt: 1700000000000,
          },
        ],
      })
    );
    const h = data.habits[0];
    assert(
      repaired === true &&
        data.habits.length === 1 &&
        h.id === 'h-fields' &&
        h.category === undefined &&
        !('category' in h) &&
        h.targetDaysPerWeek === 7 &&
        JSON.stringify(h.customDays) === JSON.stringify([0, 3, 6]) &&
        h.vacationPeriods?.length === 1 &&
        h.vacationPeriods[0].id === 'v-ok' &&
        h.scheduleType === undefined &&
        !('scheduleType' in h),
      'invalid ids dropped; category, targetDaysPerWeek (1-7), customDays (0-6), vacationPeriods (valid & start<=end), and scheduleType repaired'
    );
  }

  // 5. Valid habit passes through completely unchanged with repaired === false
  {
    const validHabit: Habit = {
      id: 'h-valid-1',
      name: 'Deep Work',
      category: 'Academics',
      targetDaysPerWeek: 5,
      completedDates: ['2026-11-12', '2026-11-13'],
      streak: 2,
      bestStreak: 5,
      createdAt: 1700000000000,
      scheduleType: 'custom_days',
      customDays: [1, 3, 5],
      vacationPeriods: [{ id: 'vac-1', startDate: '2026-12-20', endDate: '2026-12-28', reason: 'Winter break' }],
      updatedAt: 1700000005000,
    };

    const { data, repaired } = sanitizeUserAppData(
      makeBasePayload({
        habits: [validHabit],
      })
    );
    assert(
      repaired === false &&
        data.habits.length === 1 &&
        JSON.stringify(data.habits[0]) === JSON.stringify(validHabit),
      'valid habit passes through completely unchanged with repaired=false'
    );
  }

  // 6. exportHabitsCsv with missing or invalid createdAt does not throw and leaves CreatedAt cell empty
  {
    let capturedBlobText = '';
    const origBlob = globalThis.Blob;
    const origCreateObjectURL = globalThis.URL.createObjectURL;
    const origRevokeObjectURL = globalThis.URL.revokeObjectURL;
    const origDocument = (globalThis as any).document;

    class MockBlob {
      parts: any[];
      constructor(parts: any[]) {
        this.parts = parts;
      }
    }
    (globalThis as any).Blob = MockBlob;
    (globalThis.URL as any).createObjectURL = (blob: any) => {
      capturedBlobText = String(blob.parts.join(''));
      return 'blob:mock-habits-csv';
    };
    (globalThis.URL as any).revokeObjectURL = () => {};
    (globalThis as any).document = {
      createElement: () => ({
        href: '',
        download: '',
        click() {},
      }),
      body: {
        appendChild() {},
        removeChild() {},
      },
    };

    try {
      let exportError: unknown = null;
      try {
        exportHabitsCsv([
          {
            id: 'h-no-created',
            name: 'No CreatedAt',
            targetDaysPerWeek: 7,
            completedDates: ['2026-11-01'],
            streak: 1,
            bestStreak: 1,
          } as unknown as Habit,
          {
            id: 'h-nan-created',
            name: 'NaN CreatedAt',
            targetDaysPerWeek: 7,
            completedDates: [],
            streak: 0,
            bestStreak: 0,
            createdAt: Number.NaN,
          },
        ]);
      } catch (e) {
        exportError = e;
      }

      const lines = capturedBlobText.trim().split('\n');
      assert(
        exportError === null &&
          lines.length === 3 &&
          lines[1].endsWith(',""') &&
          lines[2].endsWith(',""'),
        'exportHabitsCsv skips missing/invalid createdAt without throwing and writes empty CreatedAt cell'
      );
    } finally {
      globalThis.Blob = origBlob;
      globalThis.URL.createObjectURL = origCreateObjectURL;
      globalThis.URL.revokeObjectURL = origRevokeObjectURL;
      if (origDocument === undefined) {
        delete (globalThis as any).document;
      } else {
        (globalThis as any).document = origDocument;
      }
    }
  }

  console.log('--- All Habit Sanitization & CSV Export Tests Passed! ---');
}

runHabitSanitizeTests();
