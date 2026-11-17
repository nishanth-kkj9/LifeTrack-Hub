import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
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
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

function setReactInputValue(el: HTMLInputElement, value: string) {
  const proto = dom.window.HTMLInputElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  nativeSetter?.call(el, value);
  const reactPropsKey = Object.keys(el).find((k) => k.startsWith('__reactProps$'));
  const reactProps = reactPropsKey ? (el as any)[reactPropsKey] : null;
  if (reactProps && typeof reactProps.onChange === 'function') {
    reactProps.onChange({ target: el, currentTarget: el });
  } else {
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  }
}

async function runHabitEngineAndReminderTests() {
  console.log('--- Starting Single Streak Engine, No-Stale-Metrics & Habit Reminder Tests ---');

  const { calculateHabitStreaks, generateDueDates } = await import('../src/lib/schedule.ts');
  const { getHabitStats } = await import('../src/lib/habitScoring.ts');
  const { exportHabitsCsv } = await import('../src/lib/dataExport.ts');
  const { sanitizeUserAppData, EMPTY_USER_DATA } = await import('../src/lib/firebase.ts');
  const { HabitCard } = await import('../src/components/habits/HabitCard.tsx');
  const { CommandPalette } = await import('../src/components/common/CommandPalette.tsx');
  const { HabitDetailModal } = await import('../src/components/todo/HabitDetailModal.tsx');
  const {
    getDueHabitReminders,
    dispatchDueHabitNotifications,
  } = await import('../src/lib/habitReminders.ts');

  // 1. schedule.ts calculateHabitStreaks delegates to getHabitStats and keep generateDueDates working
  {
    const refDate = new Date(2026, 10, 12, 12, 0, 0); // 2026-11-12
    const empty = calculateHabitStreaks([], refDate);
    assert(empty.current === 0 && empty.longest === 0, 'Empty dates return { current: 0, longest: 0 }');

    const withVac = calculateHabitStreaks(
      ['2026-11-12', '2026-11-11', '2026-11-08', '2026-11-07'],
      refDate,
      [{ id: 'v1', startDate: '2026-11-09', endDate: '2026-11-10' }]
    );
    const expectedStats = getHabitStats(
      {
        id: 'cmp',
        name: 'Cmp',
        targetDaysPerWeek: 7,
        completedDates: ['2026-11-12', '2026-11-11', '2026-11-08', '2026-11-07'],
        streak: 0,
        bestStreak: 0,
        createdAt: refDate.getTime(),
        vacationPeriods: [{ id: 'v1', startDate: '2026-11-09', endDate: '2026-11-10' }],
      },
      '2026-11-12'
    );
    assert(
      withVac.current === expectedStats.currentStreak &&
        withVac.longest === expectedStats.bestStreak &&
        withVac.current === 4,
      `calculateHabitStreaks matches getHabitStats across vacation bridge (current=${withVac.current}, longest=${withVac.longest})`
    );

    const due = generateDueDates({ startDate: '2026-11-01', timesPerWeek: 3 });
    assert(due.length === 3 && due[0] === '2026-11-01', 'generateDueDates stays unchanged');
  }

  // 2. Stored streak/bestStreak/habitScore/habitHealth are never relied upon in CSV, HabitCard, or CommandPalette
  {
    const todayStr = '2026-11-17';
    const staleHabit: Habit = {
      id: 'h-stale-metrics',
      name: 'Piano Practice',
      category: 'Study',
      targetDaysPerWeek: 7,
      completedDates: ['2026-11-17'],
      streak: 99,
      bestStreak: 88,
      habitScore: 97,
      habitHealth: 'Excellent',
      createdAt: 1700000000000,
      scheduleType: 'daily',
    };

    const computed = getHabitStats(staleHabit, todayStr);
    assert(
      computed.currentStreak === 1 && computed.bestStreak === 1 && computed.strengthScore < 20,
      `Canonical engine computes streak=1, best=1, strength=${computed.strengthScore} despite stale stored fields`
    );

    // HabitCard ignores stale fields
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    const root = createRoot(mount);

    await act(async () => {
      root.render(
        React.createElement(HabitCard, {
          habit: staleHabit,
          onToggle: () => {},
          todayStr,
        })
      );
    });

    const cardText = mount.textContent || '';
    assert(
      !cardText.includes('99') &&
        !cardText.includes('97') &&
        cardText.includes(`${computed.strengthScore}/100`) &&
        cardText.includes('1d'),
      'HabitCard ignores stored streak/habitScore/habitHealth and displays computed values'
    );

    // CommandPalette ignores stale streak
    await act(async () => {
      root.render(
        React.createElement(CommandPalette, {
          isOpen: true,
          onClose: () => {},
          onNavigate: () => {},
          onOpenAddTask: () => {},
          onOpenAddTransaction: () => {},
          onOpenAddExam: () => {},
          onOpenAddNote: () => {},
          tasks: [],
          exams: [],
          habits: [staleHabit],
          notes: [],
        })
      );
    });

    const searchInput = mount.querySelector('input') as HTMLInputElement | null;
    await act(async () => {
      if (searchInput) setReactInputValue(searchInput, 'Piano');
    });
    const paletteText = mount.textContent || '';
    assert(
      !paletteText.includes('99') && paletteText.includes('Piano Practice'),
      'CommandPalette computes streak instead of reading stored habit.streak=99'
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
      root.unmount();
    });
    mount.remove();

    // CSV export ignores stale streak and stale bestStreak
    let csvOut = '';
    const origBlob = globalThis.Blob;
    const origCreateObjectURL = globalThis.URL.createObjectURL;
    const origRevokeObjectURL = globalThis.URL.revokeObjectURL;
    const origCreateElement = document.createElement.bind(document);
    class MockBlob {
      parts: any[];
      constructor(parts: any[]) {
        this.parts = parts;
      }
    }
    (globalThis as any).Blob = MockBlob;
    (globalThis.URL as any).createObjectURL = (blob: any) => {
      csvOut = String(blob.parts.join(''));
      return 'blob:mock-csv';
    };
    (globalThis.URL as any).revokeObjectURL = () => {};
    (document as any).createElement = (tag: string) => {
      const el = origCreateElement(tag);
      if (tag.toLowerCase() === 'a') el.click = () => {};
      return el;
    };
    try {
      exportHabitsCsv([staleHabit], todayStr);
      const rows = csvOut.trim().split('\n');
      assert(
        rows.length === 2 && !rows[1].includes('"99"') && !rows[1].includes('"88"'),
        'exportHabitsCsv recomputes CurrentStreak and BestStreak via getHabitStats (ignores stale 99 and 88)'
      );
    } finally {
      globalThis.Blob = origBlob;
      globalThis.URL.createObjectURL = origCreateObjectURL;
      globalThis.URL.revokeObjectURL = origRevokeObjectURL;
      (document as any).createElement = origCreateElement;
    }
  }

  // 3. Per-habit optional reminderTime: sanitization, permission-on-set-only, open-app notification logic
  {
    const validSan = sanitizeUserAppData({
      ...EMPTY_USER_DATA,
      habits: [
        {
          id: 'h-rem-ok',
          name: 'Hydrate',
          targetDaysPerWeek: 7,
          completedDates: [],
          streak: 0,
          bestStreak: 0,
          createdAt: 1700000000000,
          reminderTime: '08:30',
          updatedAt: 1700000000000,
        },
      ],
    });
    assert(
      validSan.repaired === false && validSan.data.habits[0].reminderTime === '08:30',
      'Sanitizer keeps valid HH:MM reminderTime untouched'
    );

    const invalidSan = sanitizeUserAppData({
      ...EMPTY_USER_DATA,
      habits: [
        {
          id: 'h-rem-bad',
          name: 'Bad Time',
          targetDaysPerWeek: 7,
          completedDates: [],
          streak: 0,
          bestStreak: 0,
          createdAt: 1700000000000,
          reminderTime: '25:99',
        },
      ],
    });
    assert(
      invalidSan.repaired === true && invalidSan.data.habits[0].reminderTime === undefined,
      'Sanitizer removes invalid reminderTime with repaired=true'
    );

    // Mock Notification API to verify permission is ONLY requested when user sets a reminder
    const origNotification = (globalThis as any).Notification;
    let permissionRequests = 0;
    const sentNotifications: Array<{ title: string; options: any }> = [];
    let currentPerm: NotificationPermission = 'default';

    class MockNotification {
      static get permission() {
        return currentPerm;
      }
      static requestPermission() {
        permissionRequests++;
        currentPerm = 'granted';
        return Promise.resolve(currentPerm);
      }
      constructor(title: string, options?: any) {
        sentNotifications.push({ title, options });
      }
    }
    (globalThis as any).Notification = MockNotification;
    (dom.window as any).Notification = MockNotification;

    try {
      const mount = document.createElement('div');
      document.body.appendChild(mount);
      const root = createRoot(mount);
      const savedHabits: Habit[] = [];

      await act(async () => {
        root.render(
          React.createElement(HabitDetailModal, {
            isOpen: true,
            onClose: () => {},
            todayStr: '2026-11-17',
            habit: {
              id: 'h-rem-ui',
              name: 'Evening Walk',
              targetDaysPerWeek: 7,
              completedDates: [],
              streak: 0,
              bestStreak: 0,
              createdAt: 1700000000000,
            },
            onUpdateHabit: (h: Habit) => savedHabits.push(h),
            onDeleteHabit: () => {},
          })
        );
      });

      assert(permissionRequests === 0, 'Opening HabitDetailModal does NOT request Notification permission');

      const timeInput = document.getElementById('habit-reminder-time-input') as HTMLInputElement | null;
      const saveBtn = document.getElementById('habit-reminder-save-btn') as HTMLButtonElement | null;

      await act(async () => {
        if (timeInput) setReactInputValue(timeInput, '19:45');
      });
      assert(saveBtn !== null && saveBtn.disabled === false, 'Setting valid HH:MM enables Set Reminder button');

      await act(async () => {
        saveBtn?.click();
        timeInput?.closest('form')?.dispatchEvent(
          new dom.window.Event('submit', { bubbles: true, cancelable: true })
        );
      });

      assert(
        permissionRequests === 1 &&
          savedHabits.length >= 1 &&
          savedHabits[savedHabits.length - 1].reminderTime === '19:45',
        'Setting reminder asks Notification permission once and stores reminderTime=19:45'
      );

      // Clear reminder should NOT request permission again
      const clearBtn = document.getElementById('habit-reminder-clear-btn') as HTMLButtonElement | null;
      await act(async () => {
        clearBtn?.click();
      });
      assert(
        permissionRequests === 1 && savedHabits[savedHabits.length - 1].reminderTime === undefined,
        'Clearing reminder removes reminderTime without requesting permission'
      );

      await act(async () => {
        root.unmount();
      });
      mount.remove();

      // Test notification firing rules: only due & unchecked at matching local HH:MM, deduped in-memory
      localStorage.clear();
      const sentSet = new Set<string>();
      const at1945 = new Date(2026, 10, 17, 19, 45, 10); // Tue 2026-11-17 19:45
      const testHabits: Habit[] = [
        {
          id: 'h-due-unchecked',
          name: 'Unchecked Due Habit',
          targetDaysPerWeek: 7,
          completedDates: [],
          streak: 0,
          bestStreak: 0,
          createdAt: 1700000000000,
          reminderTime: '19:45',
        },
        {
          id: 'h-already-done',
          name: 'Already Completed',
          targetDaysPerWeek: 7,
          completedDates: ['2026-11-17'],
          streak: 1,
          bestStreak: 1,
          createdAt: 1700000000000,
          reminderTime: '19:45',
        },
        {
          id: 'h-on-vacation',
          name: 'On Vacation',
          targetDaysPerWeek: 7,
          completedDates: [],
          streak: 0,
          bestStreak: 0,
          createdAt: 1700000000000,
          vacationPeriods: [{ id: 'v', startDate: '2026-11-16', endDate: '2026-11-18' }],
          reminderTime: '19:45',
        },
        {
          id: 'h-other-time',
          name: 'Wrong Time',
          targetDaysPerWeek: 7,
          completedDates: [],
          streak: 0,
          bestStreak: 0,
          createdAt: 1700000000000,
          reminderTime: '08:00',
        },
      ];

      const dueList = getDueHabitReminders(testHabits, at1945, sentSet);
      assert(
        dueList.length === 1 && dueList[0].habit.id === 'h-due-unchecked',
        'getDueHabitReminders matches only due, unchecked habit at exact HH:MM'
      );

      const fired1 = dispatchDueHabitNotifications(testHabits, at1945, sentSet);
      const fired2 = dispatchDueHabitNotifications(testHabits, at1945, sentSet);
      assert(
        fired1 === 1 &&
          fired2 === 0 &&
          sentNotifications.length === 1 &&
          sentNotifications[0].title === 'Unchecked Due Habit' &&
          localStorage.length === 0,
        'dispatchDueHabitNotifications fires once per minute in-memory and writes nothing to localStorage'
      );
    } finally {
      if (origNotification === undefined) {
        delete (globalThis as any).Notification;
        delete (dom.window as any).Notification;
      } else {
        (globalThis as any).Notification = origNotification;
        (dom.window as any).Notification = origNotification;
      }
    }
  }

  console.log('--- All Single Streak Engine, No-Stale-Metrics & Habit Reminder Tests Passed! ---');
}

runHabitEngineAndReminderTests();
