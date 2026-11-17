import { JSDOM } from 'jsdom';
import React, { act, useState } from 'react';
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
Object.defineProperty(globalThis, 'HTMLTextAreaElement', { value: dom.window.HTMLTextAreaElement, writable: true, configurable: true });
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

function setReactTextareaValue(el: HTMLTextAreaElement, value: string) {
  const proto = dom.window.HTMLTextAreaElement.prototype;
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

async function runHabitDetailCalendarAndNotesTests() {
  console.log('--- Starting HabitDetailModal Calendar, Notes, Sanitizer & CSV Tests ---');

  const { HabitDetailModal } = await import('../src/components/todo/HabitDetailModal.tsx');
  const { sanitizeUserAppData, EMPTY_USER_DATA } = await import('../src/lib/firebase.ts');
  const { exportHabitsCsv } = await import('../src/lib/dataExport.ts');

  const todayStr = '2026-11-17';
  const yesterdayStr = '2026-11-16';
  const twoDaysAgoStr = '2026-11-15';
  const vacationDayStr = '2026-11-10';
  const missedDayStr = '2026-11-05';
  const futureDayStr = '2026-11-20';
  const customRestDayStr = '2026-11-17'; // Tuesday

  // 1. Month calendar statuses, back-filling yesterday raises streak, future day disabled, notes trimmed <= 280 chars
  {
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    const root = createRoot(mount);

    const toggleCalls: Array<{ habitId: string; dateStr: string }> = [];
    const updateCalls: Habit[] = [];

    const seedHabit: Habit = {
      id: 'h-cal-1',
      name: 'Morning Reading',
      category: 'Study',
      targetDaysPerWeek: 7,
      completedDates: [twoDaysAgoStr, todayStr],
      streak: 1,
      bestStreak: 2,
      createdAt: 1700000000000,
      scheduleType: 'daily',
      vacationPeriods: [
        {
          id: 'vac-nov',
          startDate: '2026-11-10',
          endDate: '2026-11-12',
          reason: 'Family trip',
        },
      ],
    };

    const Harness: React.FC = () => {
      const [habitState, setHabitState] = useState<Habit>(seedHabit);
      return React.createElement(HabitDetailModal, {
        isOpen: true,
        onClose: () => {},
        habit: habitState,
        todayStr,
        onToggleHabitDate: (habitId: string, dateStr: string) => {
          toggleCalls.push({ habitId, dateStr });
          setHabitState((prev) => {
            const exists = prev.completedDates.includes(dateStr);
            return {
              ...prev,
              completedDates: exists
                ? prev.completedDates.filter((d) => d !== dateStr)
                : [...prev.completedDates, dateStr],
            };
          });
        },
        onUpdateHabit: (updated: Habit) => {
          updateCalls.push(updated);
          setHabitState(updated);
        },
        onDeleteHabit: () => {},
      });
    };

    await act(async () => {
      root.render(React.createElement(Harness));
    });

    const todayCell = document.querySelector(`[data-testid="habit-calendar-cell-${todayStr}"]`);
    const yesterdayCell = document.querySelector(`[data-testid="habit-calendar-cell-${yesterdayStr}"]`);
    const missedCell = document.querySelector(`[data-testid="habit-calendar-cell-${missedDayStr}"]`);
    const vacCell = document.querySelector(`[data-testid="habit-calendar-cell-${vacationDayStr}"]`);
    const futureCell = document.querySelector(`[data-testid="habit-calendar-cell-${futureDayStr}"]`);

    assert(
      todayCell?.getAttribute('data-day-status') === 'done' &&
        yesterdayCell?.getAttribute('data-day-status') === 'missed' &&
        missedCell?.getAttribute('data-day-status') === 'missed' &&
        vacCell?.getAttribute('data-day-status') === 'rest' &&
        futureCell?.getAttribute('data-day-status') === 'future',
      'Month calendar classifies done, missed, rest (vacation), and future cells accurately'
    );

    // Future day button must be disabled and clicking it must not toggle
    const futureBtn = document.querySelector(
      `[data-testid="habit-calendar-day-btn-${futureDayStr}"]`
    ) as HTMLButtonElement | null;
    assert(futureBtn !== null && futureBtn.disabled === true, 'Future day button in calendar is disabled');

    await act(async () => {
      futureBtn?.click();
    });
    assert(toggleCalls.length === 0, 'Clicking disabled future day does not call onToggleHabitDate');

    // Initial active streak is 1d (only today connected since yesterday 2026-11-16 was missed)
    const activeStreakBefore = mount.textContent || '';
    assert(activeStreakBefore.includes('1d'), 'Initial active streak before back-fill is 1d');

    // Back-fill yesterday via calendar day click
    const yesterdayBtn = document.querySelector(
      `[data-testid="habit-calendar-day-btn-${yesterdayStr}"]`
    ) as HTMLButtonElement | null;
    assert(yesterdayBtn !== null && yesterdayBtn.disabled === false, 'Past day button (yesterday) is enabled');

    await act(async () => {
      yesterdayBtn?.click();
    });

    assert(
      toggleCalls.length === 1 &&
        toggleCalls[0].habitId === 'h-cal-1' &&
        toggleCalls[0].dateStr === yesterdayStr,
      'Clicking yesterday toggles completion via onToggleHabitDate'
    );
    assert(
      yesterdayCell?.getAttribute('data-day-status') === 'done' &&
        (mount.textContent || '').includes('3d'),
      'Back-filling yesterday updates calendar cell to done and raises active streak (1d -> 3d)'
    );

    // Open per-day note editor via secondary button and verify length + whitespace trimming (max 280 chars)
    const noteBtn = document.querySelector(
      `[data-testid="habit-day-note-btn-${yesterdayStr}"]`
    ) as HTMLButtonElement | null;
    assert(noteBtn !== null, 'Secondary note button renders on non-future day');

    await act(async () => {
      noteBtn?.click();
    });

    const noteInput = document.getElementById('habit-day-note-input') as HTMLTextAreaElement | null;
    const noteSaveBtn = document.getElementById('habit-day-note-save-btn') as HTMLButtonElement | null;
    assert(noteInput !== null && noteSaveBtn !== null, 'Note editor opens when secondary note button is clicked');

    const overlong = 'x'.repeat(320);
    await act(async () => {
      if (noteInput) setReactTextareaValue(noteInput, overlong);
    });
    assert(
      noteInput?.value.length === 280,
      `Note input enforces 280-char max length on input (${noteInput?.value.length})`
    );

    await act(async () => {
      noteSaveBtn?.click();
      noteInput?.closest('form')?.dispatchEvent(
        new dom.window.Event('submit', { bubbles: true, cancelable: true })
      );
    });

    assert(
      updateCalls.length >= 1 &&
        updateCalls[updateCalls.length - 1].notes?.[yesterdayStr] === 'x'.repeat(280),
      'Saved long per-day note is trimmed to exactly 280 chars'
    );

    // Verify surrounding whitespace is also trimmed cleanly
    const noteBtnAgain = document.querySelector(
      `[data-testid="habit-day-note-btn-${yesterdayStr}"]`
    ) as HTMLButtonElement | null;
    await act(async () => {
      noteBtnAgain?.click();
    });
    const noteInput2 = document.getElementById('habit-day-note-input') as HTMLTextAreaElement | null;
    const noteSaveBtn2 = document.getElementById('habit-day-note-save-btn') as HTMLButtonElement | null;
    await act(async () => {
      if (noteInput2) setReactTextareaValue(noteInput2, '   Read 2 chapters before bed   ');
    });
    await act(async () => {
      noteSaveBtn2?.click();
      noteInput2?.closest('form')?.dispatchEvent(
        new dom.window.Event('submit', { bubbles: true, cancelable: true })
      );
    });
    assert(
      updateCalls[updateCalls.length - 1].notes?.[yesterdayStr] === 'Read 2 chapters before bed',
      'Saved per-day note trims leading and trailing whitespace'
    );

    // Verify long-press on a past day also opens the note editor without toggling completion
    const missedBtn = document.querySelector(
      `[data-testid="habit-calendar-day-btn-${missedDayStr}"]`
    ) as HTMLButtonElement | null;
    assert(missedBtn !== null, 'Past missed day button exists for long-press test');
    const toggleCountBeforeLongPress = toggleCalls.length;
    await act(async () => {
      missedBtn?.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 500));
      missedBtn?.dispatchEvent(new dom.window.Event('pointerup', { bubbles: true }));
      missedBtn?.click();
    });
    const longPressEditorLabel = document.querySelector('[data-testid="habit-day-note-editor"] label')?.textContent || '';
    assert(
      longPressEditorLabel.includes(missedDayStr) && toggleCalls.length === toggleCountBeforeLongPress,
      'Long-pressing a past day opens its note editor without toggling completion'
    );

    // Custom days habit marks non-scheduled weekday as rest
    const customMount = document.createElement('div');
    document.body.appendChild(customMount);
    const customRoot = createRoot(customMount);
    await act(async () => {
      customRoot.render(
        React.createElement(HabitDetailModal, {
          isOpen: true,
          onClose: () => {},
          todayStr,
          habit: {
            id: 'h-cal-custom',
            name: 'MWF Gym',
            targetDaysPerWeek: 3,
            completedDates: ['2026-11-16'],
            streak: 1,
            bestStreak: 1,
            createdAt: 1700000000000,
            scheduleType: 'custom_days',
            customDays: [1, 3, 5],
          },
          onUpdateHabit: () => {},
          onDeleteHabit: () => {},
        })
      );
    });
    const customRestCell = customMount.querySelector(
      `[data-testid="habit-calendar-cell-${customRestDayStr}"]`
    );
    assert(
      customRestCell?.getAttribute('data-day-status') === 'rest',
      'Non-due custom_days weekday (Tuesday) renders as rest in month calendar'
    );

    await act(async () => {
      customRoot.unmount();
      root.unmount();
    });
    customMount.remove();
    mount.remove();
  }

  // 2. Sanitizer keeps notes only if an object of string values
  {
    const validHabit: Habit = {
      id: 'h-notes-valid',
      name: 'Meditation',
      targetDaysPerWeek: 7,
      completedDates: ['2026-11-16'],
      streak: 1,
      bestStreak: 1,
      createdAt: 1700000000000,
      notes: {
        '2026-11-16': 'Calm 15m session',
      },
      updatedAt: 1700000000000,
    };
    const validRes = sanitizeUserAppData({
      ...EMPTY_USER_DATA,
      habits: [validHabit],
    });
    assert(
      validRes.repaired === false &&
        validRes.data.habits[0].notes?.['2026-11-16'] === 'Calm 15m session',
      'Sanitizer preserves valid Habit.notes object untouched with repaired=false'
    );

    const badShapeRes = sanitizeUserAppData({
      ...EMPTY_USER_DATA,
      habits: [
        {
          id: 'h-notes-array',
          name: 'Reading',
          targetDaysPerWeek: 7,
          completedDates: [],
          streak: 0,
          bestStreak: 0,
          createdAt: 1700000000000,
          notes: ['not-an-object'],
        },
        {
          id: 'h-notes-mixed',
          name: 'Hydrate',
          targetDaysPerWeek: 7,
          completedDates: [],
          streak: 0,
          bestStreak: 0,
          createdAt: 1700000000000,
          notes: {
            '2026-11-15': 'Valid entry',
            '2026-11-16': 12345,
            'not-a-date': 'Dropped',
            '2026-11-14': 'y'.repeat(310),
          },
        },
      ],
    });
    assert(
      badShapeRes.repaired === true &&
        badShapeRes.data.habits[0].notes === undefined &&
        !('notes' in badShapeRes.data.habits[0]) &&
        badShapeRes.data.habits[1].notes?.['2026-11-15'] === 'Valid entry' &&
        badShapeRes.data.habits[1].notes?.['2026-11-16'] === undefined &&
        badShapeRes.data.habits[1].notes?.['not-a-date'] === undefined &&
        badShapeRes.data.habits[1].notes?.['2026-11-14']?.length === 280,
      'Sanitizer drops non-object notes, drops non-string/invalid-date entries, and caps note strings to 280 chars'
    );
  }

  // 3. exportHabitsCsv adds VacationPeriods and Notes columns and recomputes CurrentStreak via getHabitStats
  {
    let capturedCsv = '';
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
      capturedCsv = String(blob.parts.join(''));
      return 'blob:mock-habit-csv';
    };
    (globalThis.URL as any).revokeObjectURL = () => {};
    (document as any).createElement = (tagName: string) => {
      const el = origCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') {
        el.click = () => {};
      }
      return el;
    };

    try {
      exportHabitsCsv(
        [
          {
            id: 'h-csv-1',
            name: 'Daily Coding',
            category: 'Study',
            targetDaysPerWeek: 7,
            completedDates: ['2026-11-15', '2026-11-16', '2026-11-17'],
            streak: 99, // intentionally stale stored value
            bestStreak: 2,
            createdAt: 1700000000000,
            vacationPeriods: [
              {
                id: 'v-1',
                startDate: '2026-11-10',
                endDate: '2026-11-12',
                reason: 'Break',
              },
            ],
            notes: {
              '2026-11-16': 'Solved 4 graphs',
            },
          },
        ],
        todayStr
      );

      const lines = capturedCsv.trim().split('\n');
      assert(lines.length === 2, 'CSV export produces header + 1 habit row');
      assert(
        lines[0].includes('"VacationPeriods"') && lines[0].includes('"Notes"'),
        'CSV header includes VacationPeriods and Notes columns'
      );
      assert(
        lines[1].includes('"3"') && !lines[1].includes('"99"'),
        'CSV export recomputes CurrentStreak via getHabitStats (3 instead of stale 99)'
      );
      assert(
        lines[1].includes('2026-11-10..2026-11-12 (Break)') &&
          lines[1].includes('2026-11-16: Solved 4 graphs'),
        'CSV export serializes VacationPeriods and Notes cleanly'
      );
    } finally {
      globalThis.Blob = origBlob;
      globalThis.URL.createObjectURL = origCreateObjectURL;
      globalThis.URL.revokeObjectURL = origRevokeObjectURL;
      (document as any).createElement = origCreateElement;
    }
  }

  console.log('--- All HabitDetailModal Calendar, Notes, Sanitizer & CSV Tests Passed! ---');
}

runHabitDetailCalendarAndNotesTests();
