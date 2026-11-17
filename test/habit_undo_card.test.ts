import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import type { Habit } from '../src/types/index.ts';

const dom = new JSDOM(
  '<!DOCTYPE html><html><head><title>LifeTrack Hub</title></head><body><div id="root"></div></body></html>',
  {
    url: 'http://localhost:3000',
    pretendToBeVisual: true,
  }
);

Object.defineProperty(globalThis, 'window', { value: dom.window, writable: true, configurable: true });
Object.defineProperty(globalThis, 'document', { value: dom.window.document, writable: true, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: dom.window.localStorage, writable: true, configurable: true });
Object.defineProperty(globalThis, 'HTMLElement', { value: dom.window.HTMLElement, writable: true, configurable: true });
Object.defineProperty(globalThis, 'HTMLInputElement', { value: dom.window.HTMLInputElement, writable: true, configurable: true });
Object.defineProperty(globalThis, 'KeyboardEvent', { value: dom.window.KeyboardEvent, writable: true, configurable: true });
Object.defineProperty(globalThis, 'CustomEvent', { value: dom.window.CustomEvent, writable: true, configurable: true });
Object.defineProperty(globalThis, 'Blob', { value: dom.window.Blob, writable: true, configurable: true });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis.window as any).AudioContext = class {
  createOscillator() { return { type: '', frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
  createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} }; }
  createBufferSource() { return { buffer: null, loop: false, connect() {}, start() {}, stop() {} }; }
  createBuffer() { return { getChannelData: () => new Float32Array(1024) }; }
  destination = {};
  currentTime = 0;
};

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runHabitUndoAndCardTests() {
  console.log('--- Starting Habit Undo Delete & HabitCard Behavior Tests ---');

  const { default: App } = await import('../src/App.tsx');
  const { HabitCard } = await import('../src/components/habits/HabitCard.tsx');
  const { getLocalDateOffset, getLocalDateString } = await import('../src/lib/dateUtils.ts');

  const todayStr = getLocalDateString();
  const completedDatesSeed = [
    getLocalDateOffset(-3),
    getLocalDateOffset(-2),
    getLocalDateOffset(-1),
    todayStr,
  ];
  const initialUpdatedAt = 1700000000000;

  dom.window.localStorage.clear();
  dom.window.localStorage.setItem(
    'lifetrack_app_data_v1',
    JSON.stringify({
      tasks: [],
      transactions: [],
      exams: [],
      habits: [
        {
          id: 'habit-undo-grid',
          name: 'Morning Algorithms',
          category: 'Study',
          targetDaysPerWeek: 7,
          completedDates: completedDatesSeed,
          streak: 4,
          bestStreak: 4,
          scheduleType: 'daily',
          createdAt: initialUpdatedAt,
          updatedAt: initialUpdatedAt,
        },
        {
          id: 'habit-undo-card',
          name: 'Evening Mobility',
          category: 'Fitness',
          targetDaysPerWeek: 7,
          completedDates: completedDatesSeed,
          streak: 4,
          bestStreak: 4,
          scheduleType: 'daily',
          createdAt: initialUpdatedAt,
          updatedAt: initialUpdatedAt,
        },
      ],
      notes: [],
      dailyMetrics: [],
      budget: { monthlyBudget: 0, savingsGoal: 0 },
      version: 1,
      lastUpdated: initialUpdatedAt,
    })
  );

  // 1. Delete from Grid -> 6s "Habit deleted - Undo" toast -> Undo restores streak & completedDates
  const container = document.getElementById('root')!;
  const root: Root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(App));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 40));
  });

  await act(async () => {
    document.getElementById('tab-nav-habits')?.click();
  });

  const gridRowBefore = document.getElementById('habit-row-habit-undo-grid');
  assert(gridRowBefore !== null, 'Seeded grid habit row renders');
  assert(
    (gridRowBefore!.textContent || '').includes('4d streak'),
    'Seeded grid habit displays 4d streak before delete'
  );

  await act(async () => {
    document.getElementById('habit-delete-habit-undo-grid')?.click();
  });

  assert(
    document.getElementById('habit-row-habit-undo-grid') === null,
    'Deleted habit disappears immediately from active Habits grid'
  );

  const toastEl = document.getElementById('habit-undo-toast-banner');
  const undoBtn = document.getElementById('habit-undo-toast-btn') as HTMLButtonElement | null;
  assert(
    toastEl !== null &&
      (toastEl.textContent || '').includes('Habit deleted -') &&
      undoBtn !== null &&
      undoBtn.textContent?.trim() === 'Undo',
    'Habit delete displays "Habit deleted - Undo" toast banner'
  );

  // Check tombstone in persisted localStorage while deleted
  const whileDeletedRaw = JSON.parse(localStorage.getItem('lifetrack_app_data_v1') || '{"habits":[]}');
  const tombstoned = whileDeletedRaw.habits.find((h: Habit) => h.id === 'habit-undo-grid');
  assert(
    tombstoned !== undefined &&
      typeof tombstoned.deletedAt === 'number' &&
      tombstoned.deletedAt > 0,
    'Deleted habit keeps tombstone with deletedAt timestamp'
  );

  // Click Undo
  await act(async () => {
    undoBtn?.click();
  });

  assert(
    document.getElementById('habit-undo-toast-banner') === null,
    'Clicking Undo dismisses habit undo toast banner'
  );
  const restoredRow = document.getElementById('habit-row-habit-undo-grid');
  assert(
    restoredRow !== null && (restoredRow.textContent || '').includes('4d streak'),
    'Restored grid habit reappears with 4d streak intact'
  );

  const afterUndoRaw = JSON.parse(localStorage.getItem('lifetrack_app_data_v1') || '{"habits":[]}');
  const restoredHabit = afterUndoRaw.habits.find((h: Habit) => h.id === 'habit-undo-grid');
  assert(
    restoredHabit !== undefined &&
      !('deletedAt' in restoredHabit) &&
      restoredHabit.updatedAt >= tombstoned.deletedAt &&
      JSON.stringify(restoredHabit.completedDates) === JSON.stringify(completedDatesSeed) &&
      restoredHabit.streak === 4,
    'Undo clears deletedAt, bumps updatedAt, and restores exact completedDates and streak'
  );

  // 2. Delete from Cards -> Undo toast -> Undo restores card + opening HabitDetailModal by clicking name
  await act(async () => {
    document.getElementById('habits-toggle-cards-btn')?.click();
  });

  const nameBtnInCard = Array.from(document.querySelectorAll('#habits-cards-grid button')).find(
    (b) => b.textContent?.trim() === 'Evening Mobility'
  ) as HTMLButtonElement | undefined;
  assert(nameBtnInCard !== undefined, 'HabitCard renders habit name as clickable button');

  await act(async () => {
    nameBtnInCard?.click();
  });

  const detailDialog = document.querySelector('[role="dialog"][aria-labelledby="habit-detail-modal-title"]');
  assert(
    detailDialog !== null && (detailDialog.textContent || '').includes('Evening Mobility'),
    'Clicking habit name in HabitCard opens HabitDetailModal'
  );

  await act(async () => {
    detailDialog?.querySelector<HTMLButtonElement>('button[aria-label="Close modal"]')?.click();
  });

  const cardDeleteBtn = document.getElementById('habit-card-delete-habit-undo-card') as HTMLButtonElement | null;
  assert(cardDeleteBtn !== null, 'HabitCard delete button exists');

  await act(async () => {
    cardDeleteBtn?.click();
  });

  assert(
    document.getElementById('habit-card-delete-habit-undo-card') === null &&
      document.getElementById('habit-undo-toast-banner') !== null,
    'Deleting from HabitCard removes card and opens "Habit deleted - Undo" toast'
  );

  await act(async () => {
    document.getElementById('habit-undo-toast-btn')?.click();
  });

  const restoredCardDeleteBtn = document.getElementById('habit-card-delete-habit-undo-card');
  const afterCardUndoRaw = JSON.parse(localStorage.getItem('lifetrack_app_data_v1') || '{"habits":[]}');
  const restoredCardHabit = afterCardUndoRaw.habits.find((h: Habit) => h.id === 'habit-undo-card');
  assert(
    restoredCardDeleteBtn !== null &&
      restoredCardHabit !== undefined &&
      !('deletedAt' in restoredCardHabit) &&
      JSON.stringify(restoredCardHabit.completedDates) === JSON.stringify(completedDatesSeed) &&
      restoredCardHabit.streak === 4,
    'Undoing card delete restores card, streak, and completedDates'
  );

  // Verify 6-second auto-dismiss removes toast
  const origSetTimeout = globalThis.setTimeout;
  const scheduledDelays: number[] = [];
  let capturedCb: (() => void) | null = null;
  (globalThis as any).setTimeout = (fn: any, ms?: number, ...rest: any[]) => {
    if (ms === 6000) {
      scheduledDelays.push(ms);
      capturedCb = () => fn(...rest);
      return 99999 as any;
    }
    return origSetTimeout(fn, ms, ...rest);
  };
  try {
    await act(async () => {
      document.getElementById('habit-card-delete-habit-undo-card')?.click();
    });
    assert(
      scheduledDelays.includes(6000) && document.getElementById('habit-undo-toast-banner') !== null,
      'Delete toast schedules 6000ms auto-dismiss timer'
    );
    await act(async () => {
      capturedCb?.();
    });
    assert(
      document.getElementById('habit-undo-toast-banner') === null,
      'Toast dismisses automatically after 6s timeout fires'
    );
  } finally {
    globalThis.setTimeout = origSetTimeout;
  }

  await act(async () => {
    root.unmount();
  });

  // 3. HabitCard standalone: 7-day strip toggle + Rest day disabled on vacation + manual override
  const cardMount = document.createElement('div');
  document.body.appendChild(cardMount);
  const cardRoot = createRoot(cardMount);

  const toggleCalls: Array<{ id: string; date: string }> = [];
  const vacationDay = '2026-11-16'; // Monday
  const vacationHabit: Habit = {
    id: 'h-vac-card',
    name: 'Travel Meditation',
    category: 'Mindfulness',
    targetDaysPerWeek: 7,
    completedDates: ['2026-11-14', '2026-11-15'],
    streak: 2,
    bestStreak: 2,
    scheduleType: 'daily',
    vacationPeriods: [
      { id: 'v-1', startDate: '2026-11-15', endDate: '2026-11-18', reason: 'Trip' },
    ],
    createdAt: 1700000000000,
  };

  await act(async () => {
    cardRoot.render(
      React.createElement(HabitCard, {
        habit: vacationHabit,
        todayStr: vacationDay,
        onToggle: (id, date) => toggleCalls.push({ id, date }),
      })
    );
  });

  const strip = cardMount.querySelector('[data-testid="habit-card-week-strip-h-vac-card"]');
  const stripBtns = strip ? Array.from(strip.querySelectorAll('button')) : [];
  assert(stripBtns.length === 7, `HabitCard renders 7-day quick strip (got ${stripBtns.length})`);

  await act(async () => {
    stripBtns[0]?.click(); // 2026-11-10
  });
  assert(
    toggleCalls.length === 1 &&
      toggleCalls[0].id === 'h-vac-card' &&
      toggleCalls[0].date === '2026-11-10',
    'Clicking a day in HabitCard 7-day strip invokes same onToggle(habitId, dateStr) handler'
  );

  const restBadge = cardMount.querySelector('[data-testid="habit-card-rest-badge-h-vac-card"]');
  assert(
    restBadge !== null && restBadge.textContent?.trim() === 'Rest day',
    'HabitCard displays "Rest day" on a vacation day'
  );

  const markBtn = Array.from(cardMount.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === 'Mark Complete'
  ) as HTMLButtonElement | undefined;
  assert(
    markBtn !== undefined && markBtn.disabled === true,
    'HabitCard disables "Mark Complete" button on a vacation day'
  );

  const overrideBtn = cardMount.querySelector(
    '[data-testid="habit-card-override-h-vac-card"]'
  ) as HTMLButtonElement | null;
  assert(overrideBtn !== null, 'HabitCard renders manual override secondary link on rest/vacation day');

  await act(async () => {
    overrideBtn?.click();
  });
  assert(
    toggleCalls.length === 2 &&
      toggleCalls[1].id === 'h-vac-card' &&
      toggleCalls[1].date === vacationDay,
    'Clicking secondary override link toggles today despite rest day'
  );

  // Non-due custom_days weekday also shows Rest day & disables Mark Complete
  const nonDueCustomHabit: Habit = {
    id: 'h-custom-rest',
    name: 'Strength Gym',
    category: 'Fitness',
    targetDaysPerWeek: 3,
    completedDates: [],
    streak: 0,
    bestStreak: 0,
    scheduleType: 'custom_days',
    customDays: [1, 3, 5], // Mon, Wed, Fri
    createdAt: 1700000000000,
  };
  await act(async () => {
    cardRoot.render(
      React.createElement(HabitCard, {
        habit: nonDueCustomHabit,
        todayStr: '2026-11-17', // Tuesday (day 2)
        onToggle: (id, date) => toggleCalls.push({ id, date }),
      })
    );
  });

  const customRestBadge = cardMount.querySelector('[data-testid="habit-card-rest-badge-h-custom-rest"]');
  const customMarkBtn = Array.from(cardMount.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === 'Mark Complete'
  ) as HTMLButtonElement | undefined;
  assert(
    customRestBadge !== null &&
      customRestBadge.textContent?.trim() === 'Rest day' &&
      customMarkBtn?.disabled === true,
    'Non-due custom_days weekday shows "Rest day" and disables "Mark Complete"'
  );

  // Clicking habit name standalone opens HabitDetailModal
  const standaloneNameBtn = Array.from(cardMount.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === 'Strength Gym'
  ) as HTMLButtonElement | undefined;
  await act(async () => {
    standaloneNameBtn?.click();
  });
  assert(
    document.querySelector('[role="dialog"][aria-labelledby="habit-detail-modal-title"]') !== null,
    'Clicking name on standalone HabitCard opens HabitDetailModal'
  );

  await act(async () => {
    cardRoot.unmount();
  });
  cardMount.remove();

  console.log('--- All Habit Undo Delete & HabitCard Behavior Tests Passed! ---');
}

runHabitUndoAndCardTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
