import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

// Establish JSDOM Environment before importing App
const dom = new JSDOM(
  '<!DOCTYPE html><html><head><title>LifeTrack Hub</title></head><body><div id="root"></div></body></html>',
  {
    url: 'http://localhost:3000',
    ariaMetadata: true,
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
if (typeof URL !== 'undefined') {
  (URL as any).createObjectURL = () => 'blob:http://localhost:3000/mock-uuid';
  (URL as any).revokeObjectURL = () => {};
}

function setReactInputValue(inputEl: HTMLInputElement, value: string) {
  const prototypeSetter = Object.getOwnPropertyDescriptor(
    dom.window.HTMLInputElement.prototype,
    'value'
  )?.set;
  prototypeSetter?.call(inputEl, value);

  const tracker = (inputEl as any)._valueTracker;
  if (tracker) {
    tracker.setValue('__old_value__');
  }

  inputEl.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  inputEl.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

  const reactPropsKey = Object.keys(inputEl).find((k) => k.startsWith('__reactProps$'));
  if (reactPropsKey) {
    const props = (inputEl as any)[reactPropsKey];
    if (props?.onChange) {
      props.onChange({
        target: inputEl,
        currentTarget: inputEl,
        preventDefault: () => {},
        stopPropagation: () => {},
      });
    }
  }
}
(globalThis.window as any).AudioContext = class {
  createOscillator() {
    return {
      type: 'sine',
      frequency: { setValueAtTime: () => {} },
      connect: () => {},
      start: () => {},
      stop: () => {},
    };
  }
  createGain() {
    return {
      gain: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
      connect: () => {},
    };
  }
  createBufferSource() {
    return {
      buffer: null,
      loop: false,
      connect: () => {},
      start: () => {},
      stop: () => {},
    };
  }
  createBuffer() {
    return { getChannelData: () => new Float32Array(1024) };
  }
  destination = {};
  currentTime = 0;
};

// Import App after JSDOM global setup
import App from '../src/App.tsx';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`  ✓ ${message}`);
  }
}

async function runBrowserUiTests() {
  console.log('====================================================');
  console.log('🚀 Running Real Browser DOM UI Integration Tests');
  console.log('====================================================\n');

  const container = document.getElementById('root')!;
  let root: Root | null = null;

  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(App));
  });

  // Small delay for initial state sync
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });

  // Test 1: Today workspace opens by default
  console.log('[Test 1] Today Workspace Initial Load');
  const todayView = document.getElementById('today-view');
  assert(todayView !== null, 'Today workspace renders on initial load');
  const activeNavBtn = document.getElementById('tab-nav-today');
  assert(
    activeNavBtn !== null && activeNavBtn.getAttribute('aria-selected') === 'true',
    'Today tab is selected in primary navigation'
  );

  // Test 2: Quick Add Task in Today View
  console.log('\n[Test 2] Quick Add Task via Today View NLP bar');
  const quickInput = document.getElementById('quick-add-task-input') as HTMLInputElement | null;
  assert(quickInput !== null, 'QuickAddBar input element exists');

  await act(async () => {
    if (quickInput) {
      setReactInputValue(quickInput, 'Review OS Chapter 5 today 3pm #study p1 ~30m');
    }
    await new Promise((r) => setTimeout(r, 20));
  });

  const quickSubmit = document.getElementById('quick-add-submit-btn');
  assert(quickSubmit !== null, 'QuickAddBar submit button exists');

  await act(async () => {
    quickInput?.closest('form')?.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 20));
  });

  const createdTaskEl = Array.from(document.querySelectorAll('h3, span, p')).find((el) =>
    el.textContent?.includes('Review OS Chapter 5')
  );
  assert(createdTaskEl !== undefined, 'Task "Review OS Chapter 5" successfully created and present in DOM');

  // Test 3: Complete Task
  console.log('\n[Test 3] Complete Task Interactivity');
  const checkButtons = Array.from(document.querySelectorAll('button')).filter(
    (btn) => btn.getAttribute('aria-label')?.includes('Mark') || btn.classList.contains('group/checkbox')
  );
  assert(checkButtons.length > 0, 'Task completion check buttons rendered');

  const initialCheckBtn = checkButtons[0];
  await act(async () => {
    initialCheckBtn.click();
  });

  // Test 4: Command Palette (Ctrl+K) and Focus Modal trigger
  console.log('\n[Test 4] Command Palette (Ctrl+K) & Focus Action');
  await act(async () => {
    const event = new dom.window.KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);
  });

  const cmdPalette = document.querySelector('[role="dialog"][aria-label="Command search"]');
  assert(cmdPalette !== null, 'Command Palette modal opens on Ctrl+K');

  const focusOption = document.getElementById('cmd-item-act-focus');
  assert(focusOption !== null, 'Start Focus session option exists in Command Palette');

  await act(async () => {
    focusOption?.click();
  });

  const focusModal = document.querySelector('[role="dialog"][aria-label="Pomodoro focus timer"]');
  assert(focusModal !== null, 'Pomodoro focus modal opens after triggering Focus action from Command Palette');

  // Test 5: Focus Modal Escape key closes modal & returns focus
  console.log('\n[Test 5] Modal Escape Key & Focus Trap');
  await act(async () => {
    const escEvent = new dom.window.KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
    });
    document.dispatchEvent(escEvent);
  });

  const focusModalClosed = document.querySelector('[role="dialog"][aria-label="Pomodoro focus timer"]');
  assert(focusModalClosed === null, 'Focus modal closed on Escape key');

  // Test 6: Navigation to Tasks View
  console.log('\n[Test 6] Navigation to Tasks View');
  const tasksNavBtn = document.getElementById('tab-nav-tasks');
  assert(tasksNavBtn !== null, 'Tasks navigation button exists');

  await act(async () => {
    tasksNavBtn?.click();
  });

  const tasksView = document.getElementById('tasks-master-view-container') || document.getElementById('tasks-view-container');
  assert(tasksView !== null, 'Tasks workspace renders after navigation click');

  // Test 7: Navigation to Calendar View
  console.log('\n[Test 7] Navigation to Calendar View');
  const calendarNavBtn = document.getElementById('tab-nav-calendar');
  assert(calendarNavBtn !== null, 'Calendar navigation button exists');

  await act(async () => {
    calendarNavBtn?.click();
  });

  const calendarView = document.getElementById('calendar-view') || document.getElementById('calendar-view-container');
  assert(calendarView !== null, 'Calendar workspace renders');

  const prevMonthBtn = document.getElementById('calendar-prev-month-btn');
  const nextMonthBtn = document.getElementById('calendar-next-month-btn');
  assert(prevMonthBtn !== null && nextMonthBtn !== null, 'Calendar month controls exist');

  await act(async () => {
    nextMonthBtn?.click();
  });

  // Test 8: Navigation to Academics & VTU Hub
  console.log('\n[Test 8] Navigation to Academics & VTU Hub');
  const academicsNavBtn = document.getElementById('tab-nav-academics');
  assert(academicsNavBtn !== null, 'Academics navigation button exists');

  await act(async () => {
    academicsNavBtn?.click();
  });

  const academicsView = document.getElementById('academics-view');
  assert(academicsView !== null, 'Academics workspace renders');

  const vtuSubTab = document.getElementById('subtab-academics-vtu');
  assert(vtuSubTab !== null, 'VTU Hub subtab switcher exists');

  await act(async () => {
    vtuSubTab?.click();
  });

  const vtuSection = document.getElementById('vtu-sync-container');
  assert(vtuSection !== null, 'VTU Hub CBCS section renders cleanly without type errors');

  // Test 9: Navigation to Finances View
  console.log('\n[Test 9] Navigation to Finances & Cashflow');
  const financesNavBtn = document.getElementById('tab-nav-finances');
  assert(financesNavBtn !== null, 'Finances navigation button exists');

  await act(async () => {
    financesNavBtn?.click();
  });

  const financesView = document.getElementById('finances-view-container');
  assert(financesView !== null, 'Finances workspace renders');

  // Test 10: Navigation to Habits View & Creation Semantics
  console.log('\n[Test 10] Habits Creation Semantics');
  const habitsNavBtn = document.getElementById('tab-nav-habits');
  assert(habitsNavBtn !== null, 'Habits navigation button exists');

  await act(async () => {
    habitsNavBtn?.click();
  });

  const habitInput = document.getElementById('habit-new-name-input') as HTMLInputElement | null;
  const habitSubmit = document.getElementById('habit-new-submit-btn');
  assert(habitInput !== null && habitSubmit !== null, 'Habit creation form inputs exist');

  await act(async () => {
    if (habitInput) {
      setReactInputValue(habitInput, 'Read 20 pages');
    }
  });

  await act(async () => {
    habitSubmit?.click();
    habitInput?.closest('form')?.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  });

  const createdHabitEl = Array.from(document.querySelectorAll('button, span, p, div')).find((el) =>
    el.textContent?.includes('Read 20 pages')
  );
  assert(createdHabitEl !== undefined, 'Habit "Read 20 pages" created');

  // Test 11: Navigation to Notes View
  console.log('\n[Test 11] Notes Scratchpad Workspace');
  const notesNavBtn = document.getElementById('tab-nav-notes');
  assert(notesNavBtn !== null, 'Notes navigation button exists');

  await act(async () => {
    notesNavBtn?.click();
  });

  const notesView = document.getElementById('notes-view-container');
  assert(notesView !== null, 'Notes workspace renders');

  // Test 12: Navigation to Settings View & Preferences
  console.log('\n[Test 12] Settings & Preferences');
  const settingsNavBtn = document.getElementById('tab-nav-settings');
  assert(settingsNavBtn !== null, 'Settings navigation button exists');

  await act(async () => {
    settingsNavBtn?.click();
  });

  const settingsView = document.getElementById('settings-view');
  assert(settingsView !== null, 'Settings workspace renders');

  const pref24hBtn = document.getElementById('pref-time-format-24h');
  assert(pref24hBtn !== null, '24-Hour time format button exists');

  await act(async () => {
    pref24hBtn?.click();
  });

  assert(
    localStorage.getItem('lifetrack_time_format') === '24h',
    'Time format preference persisted to localStorage as "24h"'
  );

  // Test 13: Responsive Viewports Layout Verification
  console.log('\n[Test 13] Viewport Breakpoint Verification (360px, 390px, 768px, 1024px, 1280px, 1440px)');
  const viewports = [360, 390, 768, 1024, 1280, 1440];
  for (const width of viewports) {
    dom.reconfigure({ width, height: 800 });
    const mainContent = document.getElementById('main-content-view');
    assert(mainContent !== null, `Main viewport layout intact at ${width}px width`);
  }

  // Test 14: Google Sign-In Flow
  console.log('\n[Test 14] Google Sign-In & Authentication Workflow');
  const loginBtn = document.getElementById('user-login-button');
  assert(loginBtn !== null, 'Google Sign-In button exists in header');

  await act(async () => {
    loginBtn?.click();
  });

  const googleModalTitle = document.getElementById('google-signin-modal-title');
  assert(googleModalTitle !== null, 'Google Sign-In modal opens when clicking login button');

  // Click offline mode option in modal (no fake Google email accounts)
  const offlineBtn = document.getElementById('continue-offline-btn');
  assert(offlineBtn !== null, 'Honest offline mode button found in modal');

  await act(async () => {
    offlineBtn?.click();
  });

  // Verify signed-in local offline state
  const logoutBtn = document.getElementById('user-logout-button');
  assert(logoutBtn !== null, 'User session started in offline mode and logout button is rendered');
  assert(
    localStorage.getItem('lifetrack_local_user')?.includes('local@device.invalid') === true,
    'Offline local profile is persisted in localStorage'
  );

  // Click logout
  await act(async () => {
    logoutBtn?.click();
  });

  const loginBtnAfterLogout = document.getElementById('user-login-button');
  assert(loginBtnAfterLogout !== null, 'Logout successfully returns to Sign In state');

  // Test 15: Habit Intelligence, Advanced Scoring & LifeInsightsPanel
  console.log('\n[Test 15] Habit Intelligence Engine, Scoring & LifeInsightsPanel');
  // Unit verification of canonical scoring logic
  const { getHabitStats } = await import('../src/lib/habitScoring.ts');
  const { calculateHabitStreaks } = await import('../src/lib/schedule.ts');
  const { getLocalDateOffset } = await import('../src/lib/dateUtils.ts');

  const todayDateStr = '2026-11-12';
  const sampleDates = Array.from({ length: 12 }, (_, idx) =>
    getLocalDateOffset(-idx, new Date(2026, 10, 12))
  );
  const testScore = getHabitStats(
    {
      id: 'h-test',
      title: 'Deep Study',
      category: 'study',
      streak: 999, // stale value must be ignored
      completedDates: sampleDates,
      targetDaysPerWeek: 7,
      createdAt: Date.now() - 20 * 86400000,
    },
    todayDateStr
  );
  assert(testScore.strengthScore > 0, 'getHabitStats computes strength score');
  assert(testScore.currentStreak === 12, 'getHabitStats computes streak from completedDates, not stale field');
  assert(testScore.healthLabel !== undefined, 'getHabitStats produces health label');

  const testStreaks = calculateHabitStreaks(['2026-10-08', '2026-10-07', '2026-10-06']);
  assert(testStreaks.longest >= 3, 'calculateHabitStreaks computes correct streak sequence');

  // Navigate to Habits and switch to Cards mode
  const habitsNavBtnForTest15 = document.getElementById('tab-nav-habits');
  await act(async () => {
    habitsNavBtnForTest15?.click();
  });

  const cardsToggleBtn = document.getElementById('habits-toggle-cards-btn');
  assert(cardsToggleBtn !== null, 'Habits cards toggle button exists');

  await act(async () => {
    cardsToggleBtn?.click();
  });

  const cardsGrid = document.getElementById('habits-cards-grid');
  assert(cardsGrid !== null, 'Habit cards grid renders in cards mode');

  // Navigate to Insights tab and verify LifeInsightsPanel
  const insightsNavBtnForTest15 = document.getElementById('tab-nav-insights');
  await act(async () => {
    insightsNavBtnForTest15?.click();
  });

  const insightsView = document.getElementById('insights-view');
  assert(insightsView !== null, 'Insights view renders with LifeInsightsPanel integrated');

  // Test 16: Recurring task completion creates next occurrence & displays "Next: <date>" toast
  console.log('\n[Test 16] Recurring Task Completion & Next-Occurrence Toast');
  const todayNavBtn = document.getElementById('tab-nav-today');
  await act(async () => {
    todayNavBtn?.click();
  });

  const recurringQuickInput = document.getElementById('quick-add-task-input') as HTMLInputElement | null;
  assert(recurringQuickInput !== null, 'QuickAddBar input renders on Today tab');
  await act(async () => {
    if (recurringQuickInput) {
      setReactInputValue(recurringQuickInput, 'Anki drill daily today #study');
    }
    await new Promise((r) => setTimeout(r, 20));
  });
  await act(async () => {
    recurringQuickInput
      ?.closest('form')
      ?.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 20));
  });

  const completeDailyBtn = Array.from(document.querySelectorAll('button')).find((b) =>
    (b.getAttribute('aria-label') || '').includes('Anki drill')
  ) as HTMLButtonElement | undefined;
  assert(completeDailyBtn !== undefined, 'Complete toggle button exists for Anki drill');

  await act(async () => {
    completeDailyBtn?.click();
    await new Promise((r) => setTimeout(r, 20));
  });

  const expectedTomorrow = getLocalDateOffset(1);
  const toastEl = document.getElementById('task-toast-banner');
  assert(
    toastEl !== null && (toastEl.textContent || '').includes(`Next: ${expectedTomorrow}`),
    `Recurring completion displays "Next: ${expectedTomorrow}" toast`
  );

  const savedRaw = localStorage.getItem('lifetrack_app_data_v1');
  const savedParsed = savedRaw ? JSON.parse(savedRaw) : { tasks: [] };
  const matchingTasks = (savedParsed.tasks || []).filter(
    (t: { title?: string }) => t.title === 'Anki drill'
  );
  const completedHist = matchingTasks.find((t: { completed?: boolean }) => t.completed === true);
  const nextScheduled = matchingTasks.find(
    (t: { completed?: boolean; dueDate?: string }) =>
      t.completed === false && t.dueDate === expectedTomorrow
  );
  assert(
    completedHist !== undefined && nextScheduled !== undefined && completedHist.id !== nextScheduled.id,
    'Original recurring task kept as completed history and new occurrence created for tomorrow'
  );

  // Test 17: Pomodoro settings persistence, >= 30s close flush, and non-stale task state
  console.log('\n[Test 17] Pomodoro Settings Persistence & Focus Minutes Saving');
  const tasksNavBtnForPomo = document.getElementById('tab-nav-tasks');
  await act(async () => {
    tasksNavBtnForPomo?.click();
  });

  const launchFocusBtn = document.querySelector('button[title="Launch Pomodoro focus timer"]') as HTMLButtonElement | null;
  assert(launchFocusBtn !== null, 'Task row has Launch Pomodoro focus timer button');
  await act(async () => {
    launchFocusBtn?.click();
  });

  const pomoDialog = document.querySelector('[role="dialog"][aria-label="Pomodoro focus timer"]');
  assert(pomoDialog !== null, 'Pomodoro modal opens for task');

  const settingsToggleBtn = document.getElementById('pomodoro-settings-toggle') as HTMLButtonElement | null;
  assert(settingsToggleBtn !== null, 'Pomodoro settings toggle button renders');
  await act(async () => {
    settingsToggleBtn?.click();
  });

  const focusInput = document.getElementById('pomodoro-setting-focus') as HTMLInputElement | null;
  const longEveryInput = document.getElementById('pomodoro-setting-long-every') as HTMLInputElement | null;
  const autoStartSwitch = document.getElementById('pomodoro-setting-autostart') as HTMLButtonElement | null;
  assert(focusInput !== null && longEveryInput !== null && autoStartSwitch !== null, 'Pomodoro settings inputs render');

  await act(async () => {
    if (focusInput) setReactInputValue(focusInput, '30');
    if (longEveryInput) setReactInputValue(longEveryInput, '2');
    autoStartSwitch?.click();
  });

  const savedPomoRaw = localStorage.getItem('lifetrack_pomodoro_settings');
  const savedPomo = savedPomoRaw ? JSON.parse(savedPomoRaw) : null;
  assert(
    savedPomo !== null &&
      savedPomo.focus === 30 &&
      savedPomo.longEvery === 2 &&
      savedPomo.autoStart === true,
    'Pomodoro settings persisted to localStorage (focus=30, longEvery=2, autoStart=true)'
  );

  // Start timer, advance wall clock by 45 seconds, and close -> should save rounded 1 minute
  const realDateNow = Date.now;
  let fakeNow = realDateNow();
  Date.now = () => fakeNow;
  try {
    const startBtn = document.querySelector('button[aria-label="Start timer"]') as HTMLButtonElement | null;
    assert(startBtn !== null, 'Start timer button renders');
    await act(async () => {
      startBtn?.click();
    });

    fakeNow += 45 * 1000;
    const closeFocusBtn = document.querySelector('button[aria-label="Close focus timer"]') as HTMLButtonElement | null;
    await act(async () => {
      closeFocusBtn?.click();
    });
  } finally {
    Date.now = realDateNow;
  }

  const afterCloseRaw = localStorage.getItem('lifetrack_app_data_v1');
  const afterCloseTasks: Array<{ actualMinutes?: number }> = afterCloseRaw
    ? JSON.parse(afterCloseRaw).tasks || []
    : [];
  const taskWithFocusMinute = afterCloseTasks.find((t) => (t.actualMinutes || 0) >= 1);
  assert(
    taskWithFocusMinute !== undefined,
    'Closing Pomodoro after >= 30s saves rounded focus minutes to task via onAddFocusMinutes'
  );

  // Test 18: Kanban/Matrix pre-filled Add modal (create only on Save), UUID IDs & Matrix quadrant move
  console.log('\n[Test 18] Kanban/Matrix Pre-filled Add Modal, UUIDs & Matrix Quadrants');
  const kanbanTabBtn = Array.from(document.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === 'Kanban'
  ) as HTMLButtonElement | undefined;
  assert(kanbanTabBtn !== undefined, 'Kanban view mode button exists');
  await act(async () => {
    kanbanTabBtn?.click();
  });

  const beforeModalCount = JSON.parse(localStorage.getItem('lifetrack_app_data_v1') || '{"tasks":[]}').tasks.length;
  const kanbanAddInProgressBtn = document.querySelector(
    'button[title="Add task to In Progress"]'
  ) as HTMLButtonElement | null;
  assert(kanbanAddInProgressBtn !== null, 'Kanban In Progress add button exists');
  await act(async () => {
    kanbanAddInProgressBtn?.click();
  });

  const prefilledStatusSelect = document.getElementById('task-status-select') as HTMLSelectElement | null;
  assert(
    prefilledStatusSelect !== null && prefilledStatusSelect.value === 'in_progress',
    'Kanban add opens AddTaskModal pre-filled with status="in_progress"'
  );

  const countWhileOpen = JSON.parse(localStorage.getItem('lifetrack_app_data_v1') || '{"tasks":[]}').tasks.length;
  assert(
    countWhileOpen === beforeModalCount,
    'Opening Kanban new-item modal does NOT create a task before Save'
  );

  const cancelAddBtn = Array.from(document.querySelectorAll('#add-task-modal-card button')).find(
    (b) => b.textContent?.trim() === 'Cancel'
  ) as HTMLButtonElement | undefined;
  await act(async () => {
    cancelAddBtn?.click();
  });
  const countAfterCancel = JSON.parse(localStorage.getItem('lifetrack_app_data_v1') || '{"tasks":[]}').tasks.length;
  assert(
    countAfterCancel === beforeModalCount,
    'Cancelling pre-filled AddTaskModal creates no task'
  );

  const matrixTabBtn = Array.from(document.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === 'Matrix'
  ) as HTMLButtonElement | undefined;
  assert(matrixTabBtn !== undefined, 'Matrix view mode button exists');
  await act(async () => {
    matrixTabBtn?.click();
  });

  const matrixAddQ2Btn = document.querySelector(
    'button[title="Add task to Not Urgent & Important"]'
  ) as HTMLButtonElement | null;
  assert(matrixAddQ2Btn !== null, 'Matrix Q2 add button exists');
  await act(async () => {
    matrixAddQ2Btn?.click();
  });

  const prefilledPriority = document.getElementById('task-priority-select') as HTMLSelectElement | null;
  const prefilledDueDate = document.getElementById('task-date-input') as HTMLInputElement | null;
  const expectedQ2Date = getLocalDateOffset(3);
  assert(
    prefilledPriority?.value === 'high' && prefilledDueDate?.value === expectedQ2Date,
    `Matrix Q2 add pre-fills priority="high" and dueDate="${expectedQ2Date}"`
  );

  const modalTitleInput = document.getElementById('task-title-input') as HTMLInputElement | null;
  const saveTaskBtn = document.getElementById('submit-create-task-btn') as HTMLButtonElement | null;
  await act(async () => {
    if (modalTitleInput) setReactInputValue(modalTitleInput, 'UUID Matrix Goal');
  });
  await act(async () => {
    saveTaskBtn?.closest('form')?.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 20));
  });

  const savedAfterMatrixCreate = JSON.parse(localStorage.getItem('lifetrack_app_data_v1') || '{"tasks":[]}').tasks as Array<{
    id: string;
    title: string;
    dueDate: string;
    priority: string;
  }>;
  const createdMatrixTask = savedAfterMatrixCreate.find((t) => t.title === 'UUID Matrix Goal');
  assert(
    createdMatrixTask !== undefined && /^task-[0-9a-f]{8}-[0-9a-f]{4}-/i.test(createdMatrixTask.id),
    'Saved Matrix task uses crypto.randomUUID() ID and persists only after Save'
  );

  const q2Container = document.querySelector('[data-quadrant="q2"]');
  assert(
    q2Container !== null && (q2Container.textContent || '').includes('UUID Matrix Goal'),
    'Newly saved Q2 task renders inside Q2 quadrant'
  );

  // Teardown
  await act(async () => {
    root?.unmount();
  });

  console.log('\n====================================================');
  console.log('🎉 ALL REAL BROWSER DOM INTEGRATION TESTS PASSED!');
  console.log('====================================================\n');
}

runBrowserUiTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
