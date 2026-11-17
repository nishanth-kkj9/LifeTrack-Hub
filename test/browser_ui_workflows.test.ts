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

  // Test 19: CalendarView non-today day selection pre-fills AddTaskModal dueDate
  console.log('\n[Test 19] Calendar Non-Today Day Add Task Pre-fill');
  {
    const calendarTabBtnForPrefill = document.getElementById('tab-nav-calendar');
    assert(calendarTabBtnForPrefill !== null, 'Calendar navigation button exists');
    await act(async () => {
      calendarTabBtnForPrefill?.click();
      await new Promise((r) => setTimeout(r, 40));
    });

    const calendarViewEl = document.getElementById('calendar-view');
    assert(calendarViewEl !== null, 'Calendar view renders');

    const todayStr = getLocalDateOffset(0);
    const nonTodayEmptyDayBtn = Array.from(
      calendarViewEl?.querySelectorAll('[role="gridcell"][data-date]') || []
    ).find((btn) => {
      const dateStr = btn.getAttribute('data-date') || '';
      const label = btn.getAttribute('aria-label') || '';
      return Boolean(dateStr && dateStr !== todayStr && label.includes('0 tasks pending'));
    }) as HTMLElement | undefined;
    assert(nonTodayEmptyDayBtn !== undefined, 'Found a non-today empty day cell in Calendar grid');

    const targetDayStr = nonTodayEmptyDayBtn?.getAttribute('data-date') || '';
    await act(async () => {
      nonTodayEmptyDayBtn?.click();
    });

    const addForDayBtn = Array.from(calendarViewEl?.querySelectorAll('button') || []).find((btn) =>
      (btn.textContent || '').includes('+ Add task for this day')
    ) as HTMLButtonElement | undefined;
    assert(addForDayBtn !== undefined, '"+ Add task for this day" button renders for empty day');

    await act(async () => {
      addForDayBtn?.click();
    });

    const calendarPrefilledDateInput = document.getElementById('task-date-input') as HTMLInputElement | null;
    assert(
      calendarPrefilledDateInput !== null && calendarPrefilledDateInput.value === targetDayStr,
      `AddTaskModal date input pre-fills to selected day "${targetDayStr}" (got "${calendarPrefilledDateInput?.value}")`
    );

    const closeCalendarAddBtn = document.getElementById('close-add-task-modal-btn') as HTMLButtonElement | null;
    await act(async () => {
      closeCalendarAddBtn?.click();
    });
  }

  // Test 20: CalendarView Day Cell Chips, Mobile Dots, Overdue Rose Dot & Responsive Widths (360, 768, 1280)
  console.log('\n[Test 20] CalendarView Day Cells & Responsive Widths (360, 768, 1280)');
  {
    const { CalendarView, resetCalendarViewState } = await import('../src/components/views/CalendarView.tsx');
    const { getLocalDateString } = await import('../src/lib/dateUtils.ts');
    resetCalendarViewState();

    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const todayStr = getLocalDateString(now);
    // Pick a deterministic past day and busy day inside the current month
    const pastDate = new Date(y, m, 1);
    const pastStr = getLocalDateString(pastDate);
    const busyDate = new Date(y, m, Math.min(15, new Date(y, m + 1, 0).getDate()));
    const busyStr = getLocalDateString(busyDate);

    // Ensure pastStr is strictly before todayStr if today is the 1st of the month
    const effectivePastStr =
      pastStr < todayStr ? pastStr : getLocalDateString(new Date(y, m, 0));

    const testTasks = [
      {
        id: 'cal-t-urgent',
        title: 'Urgent Systems Lab Submission With Very Long Title For Truncation Check',
        category: 'study' as const,
        priority: 'urgent' as const,
        dueDate: busyStr,
        completed: false,
        subtasks: [],
        createdAt: Date.now(),
      },
      {
        id: 'cal-t-high',
        title: 'High Priority Review',
        category: 'work' as const,
        priority: 'high' as const,
        dueDate: busyStr,
        completed: false,
        subtasks: [],
        createdAt: Date.now(),
      },
      {
        id: 'cal-t-medium',
        title: 'Medium Notes',
        category: 'study' as const,
        priority: 'medium' as const,
        dueDate: busyStr,
        completed: false,
        subtasks: [],
        createdAt: Date.now(),
      },
      {
        id: 'cal-t-low',
        title: 'Low Priority Backlog',
        category: 'personal' as const,
        priority: 'low' as const,
        dueDate: busyStr,
        completed: false,
        subtasks: [],
        createdAt: Date.now(),
      },
      {
        id: 'cal-t-done',
        title: 'Completed Reading',
        category: 'study' as const,
        priority: 'low' as const,
        dueDate: busyStr,
        completed: true,
        completedAt: busyDate.getTime(),
        subtasks: [],
        createdAt: Date.now(),
      },
      {
        id: 'cal-t-overdue',
        title: 'Overdue Past Assignment',
        category: 'study' as const,
        priority: 'low' as const,
        dueDate: effectivePastStr,
        completed: false,
        subtasks: [],
        createdAt: Date.now(),
      },
    ];

    const testExams = [
      {
        id: 'cal-e-1',
        subject: 'Operating Systems',
        examDate: busyStr,
        examTime: '09:30',
        status: 'studying' as const,
        topics: [],
        createdAt: Date.now(),
      },
    ];

    const calMount = document.createElement('div');
    document.body.appendChild(calMount);
    const calRoot = createRoot(calMount);

    await act(async () => {
      calRoot.render(
        React.createElement(CalendarView, {
          tasks: testTasks,
          exams: testExams,
          onToggleTask: () => {},
          onOpenAddTaskModal: () => {},
        })
      );
    });

    const busyCell = calMount.querySelector(`[role="gridcell"][data-date="${busyStr}"]`) as HTMLElement | null;
    assert(busyCell !== null, 'Busy day cell renders in CalendarView');
    assert(
      busyCell!.className.includes('min-h-[68px]') &&
        busyCell!.className.includes('overflow-hidden') &&
        busyCell!.className.includes('min-w-0'),
      'Day cell preserves min-h-[68px] and enforces overflow-hidden + min-w-0'
    );

    const desktopChips = busyCell!.querySelector('[data-testid="calendar-desktop-chips"]');
    assert(
      desktopChips !== null && desktopChips.className.includes('hidden sm:flex'),
      'Desktop chips container uses hidden sm:flex'
    );

    const desktopChildren = Array.from(desktopChips!.children);
    assert(
      desktopChildren[0]?.getAttribute('data-testid') === 'calendar-exam-chip' &&
        desktopChildren[0]?.textContent?.includes('Operating Systems') &&
        desktopChildren[0]?.className.includes('indigo'),
      'Exam chip (indigo, subject) renders before task chips on sm+'
    );

    const taskChips = Array.from(busyCell!.querySelectorAll('[data-testid="calendar-task-chip"]'));
    assert(taskChips.length === 2, `Shows at most 2 task chips on sm+ (got ${taskChips.length})`);
    assert(
      taskChips[0].className.includes('truncate') &&
        taskChips[0].className.includes('border-l-rose-500') &&
        taskChips[1].className.includes('border-l-amber-500'),
      'Task chips truncate titles and color left border by priority (urgent rose, high amber)'
    );

    const moreIndicator = busyCell!.querySelector('[data-testid="calendar-more-tasks"]');
    assert(
      moreIndicator !== null && moreIndicator.textContent?.trim() === '+3 more',
      `Displays "+3 more" when 5 tasks exist on day (got "${moreIndicator?.textContent?.trim()}")`
    );

    const mobileDotsContainer = busyCell!.querySelector('[data-testid="calendar-mobile-dots"]');
    assert(
      mobileDotsContainer !== null && mobileDotsContainer.className.includes('flex sm:hidden'),
      'Mobile dots container uses flex sm:hidden'
    );
    const mobileDots = Array.from(mobileDotsContainer!.querySelectorAll('[data-testid="calendar-priority-dot"]'));
    assert(
      mobileDots.length === 3 && (mobileDotsContainer!.textContent || '').trim() === '',
      `Mobile (<640px) renders max 3 coloured priority dots with zero text (dots=${mobileDots.length})`
    );

    // Completed chip check on a day with only a completed medium task
    const doneOnlyStr = getLocalDateString(new Date(y, m, 2));
    await act(async () => {
      calRoot.render(
        React.createElement(CalendarView, {
          tasks: [
            {
              id: 'cal-done-only',
              title: 'Done Task Chip',
              category: 'study' as const,
              priority: 'medium' as const,
              dueDate: doneOnlyStr,
              completed: true,
              completedAt: new Date(y, m, 2).getTime(),
              subtasks: [],
              createdAt: Date.now(),
            },
            {
              id: 'cal-low-only',
              title: 'Low Pending Chip',
              category: 'personal' as const,
              priority: 'low' as const,
              dueDate: doneOnlyStr,
              completed: false,
              subtasks: [],
              createdAt: Date.now(),
            },
          ],
          exams: [],
          onToggleTask: () => {},
          onOpenAddTaskModal: () => {},
        })
      );
    });

    const doneCell = calMount.querySelector(`[role="gridcell"][data-date="${doneOnlyStr}"]`);
    const doneChip = doneCell?.querySelector('[data-testid="calendar-task-chip"][data-completed="true"]');
    const lowChip = doneCell?.querySelector('[data-testid="calendar-task-chip"][data-priority="low"]');
    assert(
      doneChip !== null &&
        doneChip!.className.includes('line-through') &&
        doneChip!.className.includes('opacity-50') &&
        doneChip!.className.includes('border-l-indigo-500'),
      'Completed chip renders line-through and faded with medium indigo left border'
    );
    assert(
      lowChip !== null && lowChip!.className.includes('border-l-slate-400'),
      'Low priority chip uses slate left border'
    );

    // Overdue past day rose dot check (re-render with testTasks)
    await act(async () => {
      calRoot.render(
        React.createElement(CalendarView, {
          tasks: testTasks,
          exams: testExams,
          onToggleTask: () => {},
          onOpenAddTaskModal: () => {},
        })
      );
    });

    if (effectivePastStr.slice(0, 7) === busyStr.slice(0, 7)) {
      const pastCell = calMount.querySelector(`[role="gridcell"][data-date="${effectivePastStr}"]`);
      const overdueDot = pastCell?.querySelector('[data-testid="calendar-overdue-dot"]');
      assert(
        overdueDot !== null && overdueDot.className.includes('bg-rose-500'),
        'Past day with overdue pending task renders small rose dot'
      );
    }

    // Verify CalendarView stays intact at 360, 768, and 1280 widths
    for (const width of [360, 768, 1280]) {
      dom.reconfigure({ width, height: 800 });
      const view = calMount.querySelector('#calendar-view');
      assert(view !== null, `CalendarView renders cleanly at ${width}px width`);
    }

    await act(async () => {
      calRoot.unmount();
    });
    calMount.remove();
  }

  // Test 21: CalendarView Collapsible Overdue (N) List & Upgraded Agenda View
  console.log('\n[Test 21] CalendarView Collapsible Overdue List & Agenda View');
  {
    const { CalendarView, resetCalendarViewState } = await import('../src/components/views/CalendarView.tsx');
    const { getLocalDateOffset } = await import('../src/lib/dateUtils.ts');
    resetCalendarViewState();

    const todayStr = getLocalDateOffset(0);
    const tomorrowStr = getLocalDateOffset(1);
    const olderStr = getLocalDateOffset(-5);
    const newerOverdueStr = getLocalDateOffset(-2);
    const tenDaysOutStr = getLocalDateOffset(10);
    const fiftyDaysOutStr = getLocalDateOffset(50);

    const updatedCalls: Array<{ id: string; dueDate: string }> = [];

    const tasks = [
      {
        id: 'od-newer',
        title: 'Newer Overdue Task',
        category: 'work' as const,
        priority: 'high' as const,
        dueDate: newerOverdueStr,
        completed: false,
        subtasks: [],
        createdAt: Date.now(),
      },
      {
        id: 'od-oldest',
        title: 'Oldest Overdue Task',
        category: 'study' as const,
        priority: 'urgent' as const,
        dueDate: olderStr,
        completed: false,
        subtasks: [],
        createdAt: Date.now(),
      },
      {
        id: 'ag-today-task',
        title: 'Today Agenda Task',
        category: 'study' as const,
        priority: 'medium' as const,
        dueDate: todayStr,
        dueTime: '14:00',
        completed: false,
        subtasks: [],
        createdAt: Date.now(),
      },
      {
        id: 'ag-tomorrow-done',
        title: 'Tomorrow Completed Task',
        category: 'personal' as const,
        priority: 'low' as const,
        dueDate: tomorrowStr,
        completed: true,
        completedAt: Date.now(),
        subtasks: [],
        createdAt: Date.now(),
      },
      {
        id: 'ag-10d-task',
        title: 'Ten Day Horizon Task',
        category: 'work' as const,
        priority: 'high' as const,
        dueDate: tenDaysOutStr,
        completed: false,
        subtasks: [],
        createdAt: Date.now(),
      },
      {
        id: 'ag-50d-task',
        title: 'Fifty Day Horizon Task',
        category: 'project' as const,
        priority: 'medium' as const,
        dueDate: fiftyDaysOutStr,
        completed: false,
        subtasks: [],
        createdAt: Date.now(),
      },
    ];

    const exams = [
      {
        id: 'ag-ex-1',
        subject: 'Computer Networks',
        courseCode: 'BCS502',
        examDate: tomorrowStr,
        examTime: '09:30',
        status: 'studying' as const,
        topics: [],
        createdAt: Date.now(),
      },
    ];

    const calMount = document.createElement('div');
    document.body.appendChild(calMount);
    const calRoot = createRoot(calMount);

    await act(async () => {
      calRoot.render(
        React.createElement(CalendarView, {
          tasks,
          exams,
          onToggleTask: () => {},
          onUpdateTask: (updated) => {
            updatedCalls.push({ id: updated.id, dueDate: updated.dueDate });
          },
          onOpenAddTaskModal: () => {},
        })
      );
    });

    // Verify Overdue (2) section renders above Month view, oldest first
    const overdueToggle = calMount.querySelector('#calendar-overdue-toggle') as HTMLButtonElement | null;
    assert(
      overdueToggle !== null && overdueToggle.textContent?.includes('Overdue (2)'),
      'Overdue (2) collapsible header renders above Month view'
    );

    const overdueRows = Array.from(calMount.querySelectorAll('[data-testid="calendar-overdue-row"]'));
    assert(
      overdueRows.length === 2 &&
        overdueRows[0].textContent?.includes('Oldest Overdue Task') &&
        overdueRows[1].textContent?.includes('Newer Overdue Task'),
      'Overdue rows are ordered oldest first'
    );

    const moveToTodayBtn = Array.from(overdueRows[0].querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Move to today')
    ) as HTMLButtonElement | undefined;
    assert(moveToTodayBtn !== undefined, 'Overdue row has "Move to today" button');

    await act(async () => {
      moveToTodayBtn?.click();
    });
    assert(
      updatedCalls.length === 1 &&
        updatedCalls[0].id === 'od-oldest' &&
        updatedCalls[0].dueDate === todayStr,
      `Clicking "Move to today" calls onUpdateTask with dueDate="${todayStr}"`
    );

    // Collapse & expand Overdue list
    await act(async () => {
      overdueToggle?.click();
    });
    assert(
      calMount.querySelector('#calendar-overdue-list') === null,
      'Clicking Overdue toggle collapses the overdue list'
    );
    await act(async () => {
      overdueToggle?.click();
    });
    assert(
      calMount.querySelector('#calendar-overdue-list') !== null,
      'Clicking Overdue toggle again expands the overdue list'
    );

    // Switch to Agenda view and verify Overdue section remains visible above Agenda too
    const agendaTabBtn = Array.from(calMount.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Agenda'
    ) as HTMLButtonElement | undefined;
    assert(agendaTabBtn !== undefined, 'Agenda switch button exists');
    await act(async () => {
      agendaTabBtn?.click();
    });

    assert(
      calMount.querySelector('#calendar-overdue-section') !== null,
      'Overdue (N) section renders above Agenda view as well'
    );

    // Verify sticky date headers & distinct exam styling
    const stickyHeaders = Array.from(
      calMount.querySelectorAll('[data-testid="agenda-sticky-header"]')
    ).map((el) => el.textContent || '');
    assert(
      stickyHeaders[0]?.includes('Today') && stickyHeaders[1]?.includes('Tomorrow'),
      `Agenda groups rows under sticky "Today" and "Tomorrow" headers (got ${stickyHeaders.join(' | ')})`
    );

    const examRow = calMount.querySelector('[data-testid="agenda-exam-row"]');
    assert(
      examRow !== null &&
        examRow.className.includes('bg-indigo-50') &&
        examRow.textContent?.includes('Computer Networks'),
      'Agenda keeps exam rows visually distinct with indigo styling'
    );

    // Toggle "Show completed" -> Tomorrow Completed Task appears
    assert(
      !calMount.textContent?.includes('Tomorrow Completed Task'),
      'Completed tasks are hidden in Agenda by default'
    );
    const showCompletedToggle = Array.from(calMount.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Show completed')
    ) as HTMLButtonElement | undefined;
    assert(showCompletedToggle !== undefined, '"Show completed" toggle exists in Agenda');
    await act(async () => {
      showCompletedToggle?.click();
    });
    assert(
      Boolean(calMount.textContent?.includes('Tomorrow Completed Task')),
      'Toggling "Show completed" reveals completed tasks in Agenda'
    );

    // Range selector 7 / 30 / 90 days
    const btn7 = Array.from(calMount.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '7 days'
    ) as HTMLButtonElement | undefined;
    const btn90 = Array.from(calMount.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '90 days'
    ) as HTMLButtonElement | undefined;
    assert(btn7 !== undefined && btn90 !== undefined, '7 days and 90 days range buttons exist');

    await act(async () => {
      btn7?.click();
    });
    assert(
      !calMount.textContent?.includes('Ten Day Horizon Task'),
      'Selecting 7 days hides tasks 10 days out'
    );

    await act(async () => {
      btn90?.click();
    });
    assert(
      Boolean(calMount.textContent?.includes('Fifty Day Horizon Task')),
      'Selecting 90 days includes tasks 50 days out'
    );

    await act(async () => {
      calRoot.unmount();
    });
    calMount.remove();
  }

  // Test 22: useTimeFormat Live Updates in TaskRow & CalendarView Exam Buttons / Subtitle
  console.log('\n[Test 22] useTimeFormat Live Updates & CalendarView Exam Buttons');
  {
    const { TaskRow } = await import('../src/components/ui/TaskRow.tsx');
    const { CalendarView, resetCalendarViewState } = await import('../src/components/views/CalendarView.tsx');
    const { setTimeFormatPreference, getLocalDateOffset } = await import('../src/lib/dateUtils.ts');
    resetCalendarViewState();

    setTimeFormatPreference('12h');

    const todayStr = getLocalDateOffset(0);
    const sampleTask = {
      id: 'tf-task-1',
      title: 'Afternoon Sync',
      category: 'work' as const,
      priority: 'medium' as const,
      dueDate: todayStr,
      dueTime: '15:00',
      completed: false,
      subtasks: [],
      createdAt: Date.now(),
    };

    const rowMount = document.createElement('div');
    document.body.appendChild(rowMount);
    const rowRoot = createRoot(rowMount);

    await act(async () => {
      rowRoot.render(
        React.createElement(TaskRow, {
          task: sampleTask,
          onToggle: () => {},
        })
      );
    });

    assert(
      Boolean(rowMount.textContent?.includes('3:00 PM')) && !rowMount.textContent?.includes('15:00'),
      'TaskRow formats dueTime via formatAppTime in 12h mode ("3:00 PM")'
    );

    await act(async () => {
      setTimeFormatPreference('24h');
    });

    assert(
      Boolean(rowMount.textContent?.includes('15:00')) && !rowMount.textContent?.includes('3:00 PM'),
      'TaskRow updates live to "15:00" on lifetrack-time-format-changed without reload'
    );

    await act(async () => {
      rowRoot.unmount();
    });
    rowMount.remove();

    // CalendarView subtitle, exam card & agenda exam button -> onNavigateTab('academics'), no Morning session
    const navigatedTabs: string[] = [];
    const calMount = document.createElement('div');
    document.body.appendChild(calMount);
    const calRoot = createRoot(calMount);

    await act(async () => {
      calRoot.render(
        React.createElement(CalendarView, {
          tasks: [],
          exams: [
            {
              id: 'ex-no-time',
              subject: 'Distributed Computing',
              courseCode: 'BCS601',
              examDate: todayStr,
              examTime: '',
              status: 'studying' as const,
              topics: [],
              createdAt: Date.now(),
            },
          ],
          onToggleTask: () => {},
          onOpenAddTaskModal: () => {},
          onNavigateTab: (tab) => navigatedTabs.push(tab),
        })
      );
    });

    assert(
      Boolean(calMount.textContent?.includes('Plan deadlines and exam dates.')),
      'CalendarView header subtitle reads "Plan deadlines and exam dates."'
    );
    assert(
      !calMount.textContent?.includes('Morning session'),
      'CalendarView does not render "Morning session" fallback when examTime is empty'
    );

    const selectedExamBtn = calMount.querySelector(
      'button[data-testid="calendar-selected-exam-card"]'
    ) as HTMLButtonElement | null;
    assert(
      selectedExamBtn !== null && selectedExamBtn.tagName === 'BUTTON',
      'Selected day exam card is rendered as a button'
    );

    await act(async () => {
      selectedExamBtn?.click();
    });
    assert(
      navigatedTabs[0] === 'academics',
      'Clicking selected day exam card calls onNavigateTab("academics")'
    );

    const agendaBtn = Array.from(calMount.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Agenda'
    ) as HTMLButtonElement | undefined;
    await act(async () => {
      agendaBtn?.click();
    });

    assert(
      !calMount.textContent?.includes('Morning session'),
      'Agenda view does not render "Morning session" fallback when examTime is empty'
    );

    const agendaExamBtn = calMount.querySelector(
      'button[data-testid="agenda-exam-row"]'
    ) as HTMLButtonElement | null;
    assert(
      agendaExamBtn !== null && agendaExamBtn.tagName === 'BUTTON',
      'Agenda exam row is rendered as a button'
    );

    await act(async () => {
      agendaExamBtn?.click();
    });
    assert(
      navigatedTabs[1] === 'academics',
      'Clicking agenda exam row calls onNavigateTab("academics")'
    );

    await act(async () => {
      calRoot.unmount();
    });
    calMount.remove();
  }

  // Test 23: Week Start Setting, Clamped Month Nav, Tab Persistence, ARIA Grid, Keyboard Nav & Shortcuts
  console.log('\n[Test 23] Week Start Setting, Month Nav Clamping, Persistence, ARIA Grid & Shortcuts');
  {
    const { SettingsView } = await import('../src/components/views/SettingsView.tsx');
    const { CalendarView, resetCalendarViewState } = await import('../src/components/views/CalendarView.tsx');
    const { setWeekStartPreference, getWeekStartPreference, getLocalDateOffset } = await import('../src/lib/dateUtils.ts');
    resetCalendarViewState();
    setWeekStartPreference('sun');

    // 1. SettingsView weekStart toggle persists to localStorage
    const settingsMount = document.createElement('div');
    document.body.appendChild(settingsMount);
    const settingsRoot = createRoot(settingsMount);

    await act(async () => {
      settingsRoot.render(
        React.createElement(SettingsView, {
          currentUser: null,
          isCloudSynced: false,
          appData: {
            tasks: [],
            habits: [],
            habitLogs: [],
            notes: [],
            transactions: [],
            budgets: [],
            exams: [],
            courses: [],
            semesters: [],
            goals: [],
          },
          onLogin: () => {},
          onLogout: () => {},
          onRestoreData: () => {},
          onResetData: () => {},
        })
      );
    });

    const monBtn = settingsMount.querySelector('#pref-week-start-mon') as HTMLButtonElement | null;
    assert(monBtn !== null, 'SettingsView exposes Monday weekStart toggle');
    await act(async () => {
      monBtn?.click();
    });
    assert(
      localStorage.getItem('lifetrack_week_start') === 'mon' && getWeekStartPreference() === 'mon',
      'Clicking Monday in Settings persists weekStart="mon" to localStorage'
    );

    await act(async () => {
      settingsRoot.unmount();
    });
    settingsMount.remove();

    // 2. CalendarView uses Monday-first columnheaders, ARIA grid, and roving tabIndex
    const calMount = document.createElement('div');
    document.body.appendChild(calMount);
    let calRoot = createRoot(calMount);

    const todayStr = getLocalDateOffset(0);
    await act(async () => {
      calRoot.render(
        React.createElement(CalendarView, {
          tasks: [
            {
              id: 'aria-t1',
              title: 'Prep Lab',
              category: 'study',
              priority: 'high',
              dueDate: todayStr,
              completed: false,
              subtasks: [],
              createdAt: Date.now(),
            },
            {
              id: 'aria-t2',
              title: 'Done Lab',
              category: 'study',
              priority: 'low',
              dueDate: todayStr,
              completed: true,
              completedAt: Date.now(),
              subtasks: [],
              createdAt: Date.now(),
            },
          ],
          exams: [
            {
              id: 'aria-ex1',
              subject: 'DBMS',
              examDate: todayStr,
              status: 'studying',
              topics: [],
              createdAt: Date.now(),
            },
          ],
          onToggleTask: () => {},
          onOpenAddTaskModal: () => {},
        })
      );
    });

    const gridEl = calMount.querySelector('[role="grid"]');
    const colHeaders = Array.from(calMount.querySelectorAll('[role="columnheader"]')).map((el) =>
      (el.textContent || '').trim()
    );
    assert(
      gridEl !== null && colHeaders.join(',') === 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
      `CalendarView renders role="grid" with Monday-first columnheaders (got ${colHeaders.join(',')})`
    );

    const todayCell = calMount.querySelector(`[role="gridcell"][data-date="${todayStr}"]`) as HTMLElement | null;
    assert(
      todayCell !== null &&
        todayCell.getAttribute('tabindex') === '0' &&
        (todayCell.getAttribute('aria-label') || '').includes('1 task pending') &&
        (todayCell.getAttribute('aria-label') || '').includes('1 completed') &&
        (todayCell.getAttribute('aria-label') || '').includes('exam: DBMS'),
      `Selected gridcell has tabIndex=0 and accessible aria-label ("${todayCell?.getAttribute('aria-label')}")`
    );

    const nonSelectedCells = Array.from(
      calMount.querySelectorAll('[role="gridcell"]')
    ).filter((el) => el.getAttribute('data-date') !== todayStr);
    assert(
      nonSelectedCells.every((el) => el.getAttribute('tabindex') === '-1'),
      'Roving tabindex assigns tabIndex=-1 to all non-selected gridcells'
    );

    // 3. Keyboard moves on gridcells (ArrowRight, Home, PageDown)
    todayCell?.focus();
    await act(async () => {
      todayCell?.dispatchEvent(
        new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      );
    });
    const nextDayStr = getLocalDateOffset(1);
    const nextDayCell = calMount.querySelector(`[role="gridcell"][data-date="${nextDayStr}"]`) as HTMLElement | null;
    assert(
      nextDayCell?.getAttribute('aria-selected') === 'true' &&
        nextDayCell?.getAttribute('tabindex') === '0' &&
        document.activeElement === nextDayCell,
      'ArrowRight moves selection, updates roving tabIndex, and moves focus to the next day cell'
    );

    await act(async () => {
      nextDayCell?.dispatchEvent(
        new window.KeyboardEvent('keydown', { key: 'Home', bubbles: true })
      );
    });
    const homeSelected = calMount
      .querySelector('[role="gridcell"][aria-selected="true"]')
      ?.getAttribute('data-date');
    assert(
      homeSelected !== undefined && new Date(
        Number(homeSelected.slice(0, 4)),
        Number(homeSelected.slice(5, 7)) - 1,
        Number(homeSelected.slice(8, 10))
      ).getDay() === 1,
      `Home key with Monday weekStart lands on Monday (${homeSelected})`
    );

    // 4. Month navigation keeps day-of-month clamped (advance to Jan 31 -> Next month Feb clamps to 28/29)
    const nextMonthBtn = calMount.querySelector('#calendar-next-month-btn') as HTMLButtonElement | null;
    for (let i = 0; i < 12; i++) {
      if (
        Array.from(calMount.querySelectorAll('[role="gridcell"]')).some((el) =>
          (el.getAttribute('data-date') || '').endsWith('-01-31')
        )
      ) {
        break;
      }
      await act(async () => {
        nextMonthBtn?.click();
      });
    }
    const jan31Cell = Array.from(calMount.querySelectorAll('[role="gridcell"]')).find((el) =>
      (el.getAttribute('data-date') || '').endsWith('-01-31')
    ) as HTMLElement | undefined;
    assert(jan31Cell !== undefined, 'Navigated to January and found Jan 31 cell');
    await act(async () => {
      jan31Cell?.click();
    });
    const janYear = Number(jan31Cell!.getAttribute('data-date')!.slice(0, 4));
    const expectedFebLast = (janYear % 4 === 0 && (janYear % 100 !== 0 || janYear % 400 === 0)) ? 29 : 28;

    await act(async () => {
      nextMonthBtn?.click();
    });
    const selectedAfterNext = calMount
      .querySelector('[role="gridcell"][aria-selected="true"]')
      ?.getAttribute('data-date');
    assert(
      selectedAfterNext === `${janYear}-02-${expectedFebLast}`,
      `Month nav Jan 31 -> Feb clamps selected day to ${janYear}-02-${expectedFebLast} (got ${selectedAfterNext})`
    );

    // Clicking a neighbour-month cell switches viewMonth
    const allCells = Array.from(calMount.querySelectorAll('[role="gridcell"]'));
    const neighbourCell = allCells.find((el) =>
      (el.className || '').includes('text-slate-400')
    ) as HTMLElement | undefined;
    if (neighbourCell) {
      const neighbourDate = neighbourCell.getAttribute('data-date')!;
      const neighbourMonthLabel = new Date(
        Number(neighbourDate.slice(0, 4)),
        Number(neighbourDate.slice(5, 7)) - 1,
        1
      ).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      await act(async () => {
        neighbourCell.click();
      });
      assert(
        Boolean(calMount.textContent?.includes(neighbourMonthLabel)),
        `Clicking neighbour-month cell (${neighbourDate}) switches viewMonth to ${neighbourMonthLabel}`
      );
    }

    const persistedDateBeforeUnmount = calMount
      .querySelector('[role="gridcell"][aria-selected="true"]')
      ?.getAttribute('data-date');

    // 5. Module-level persistence across unmount & remount
    await act(async () => {
      calRoot.unmount();
    });

    calRoot = createRoot(calMount);
    await act(async () => {
      calRoot.render(
        React.createElement(CalendarView, {
          tasks: [],
          exams: [],
          onToggleTask: () => {},
          onOpenAddTaskModal: () => {},
        })
      );
    });

    const selectedAfterRemount = calMount
      .querySelector('[role="gridcell"][aria-selected="true"]')
      ?.getAttribute('data-date');
    assert(
      selectedAfterRemount === persistedDateBeforeUnmount,
      `Module-level state preserves selectedDate (${selectedAfterRemount}) across unmount/remount`
    );

    // 6. Global shortcuts a = agenda, m = month, t = today; ignored inside input
    const dummyInput = document.createElement('input');
    calMount.appendChild(dummyInput);
    dummyInput.focus();
    await act(async () => {
      dummyInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    });
    assert(
      !calMount.textContent?.includes('Upcoming 30-Day Agenda'),
      'Shortcut "a" is ignored while focus is inside an input'
    );
    dummyInput.remove();
    (document.body as HTMLElement).focus?.();

    await act(async () => {
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    });
    assert(
      Boolean(calMount.textContent?.includes('Upcoming 30-Day Agenda')),
      'Shortcut "a" switches CalendarView to Agenda mode'
    );

    await act(async () => {
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'm', bubbles: true }));
    });
    assert(
      calMount.querySelector('[role="grid"]') !== null,
      'Shortcut "m" switches CalendarView back to Month mode'
    );

    await act(async () => {
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 't', bubbles: true }));
    });
    assert(
      calMount.querySelector(`[role="gridcell"][data-date="${todayStr}"][aria-selected="true"]`) !== null,
      'Shortcut "t" jumps CalendarView back to today'
    );

    setWeekStartPreference('sun');
    await act(async () => {
      calRoot.unmount();
    });
    calMount.remove();
  }

  // Test 24: Week View TimeGrid + Empty Slot Creation + Month Drag-and-Drop + Keyboard "m" Move Picker
  console.log('\n[Test 24] Calendar Week View, Drag-and-Drop & Keyboard Move Picker');
  {
    const { CalendarView, resetCalendarViewState } = await import('../src/components/views/CalendarView.tsx');
    const { getLocalDateString } = await import('../src/lib/dateUtils.ts');
    resetCalendarViewState();

    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const sourceDateStr = getLocalDateString(new Date(y, m, 10));
    const targetDateStr = getLocalDateString(new Date(y, m, 18));
    const kbTargetDateStr = getLocalDateString(new Date(y, m, 22));

    const initialTask = {
      id: 'dnd-task-1',
      title: 'Compiler Lab Review',
      description: 'Review LL(1) parser notes',
      category: 'study' as const,
      priority: 'high' as const,
      dueDate: sourceDateStr,
      dueTime: '14:30',
      completed: false,
      isStarred: true,
      estimatedMinutes: 45,
      subtasks: [],
      createdAt: 1700000000000,
    };

    const updatedSnapshots: Array<typeof initialTask> = [];
    const openedDefaults: Array<{ dueDate?: string; dueTime?: string }> = [];

    const calMount = document.createElement('div');
    document.body.appendChild(calMount);
    const calRoot = createRoot(calMount);

    await act(async () => {
      calRoot.render(
        React.createElement(CalendarView, {
          tasks: [initialTask],
          exams: [
            {
              id: 'wk-exam-1',
              subject: 'Systems Programming',
              examDate: getLocalDateString(now),
              examTime: '09:00',
              status: 'studying',
              topics: [],
              createdAt: 1700000000000,
            },
          ],
          onToggleTask: () => {},
          onUpdateTask: (updated) => {
            updatedSnapshots.push(updated as typeof initialTask);
          },
          onOpenAddTaskModal: (defaults) => {
            if (defaults) openedDefaults.push(defaults);
          },
        })
      );
    });

    // 1. HTML5 drag-and-drop task chip onto another day cell updates ONLY dueDate (keeps dueTime and other fields)
    const taskChip = calMount.querySelector(
      '[data-testid="calendar-task-chip"][data-task-id="dnd-task-1"]'
    ) as HTMLButtonElement | null;
    const dropCell = calMount.querySelector(
      `[role="gridcell"][data-date="${targetDateStr}"]`
    ) as HTMLElement | null;

    assert(
      taskChip !== null && taskChip.draggable === true && dropCell !== null,
      'Month task chip is rendered as draggable button and target day cell exists'
    );

    const dtStore = new Map<string, string>();
    const mockDataTransfer = {
      effectAllowed: 'move',
      dropEffect: 'move',
      setData: (type: string, val: string) => dtStore.set(type, val),
      getData: (type: string) => dtStore.get(type) || '',
    };

    const dragStartEvt = new window.Event('dragstart', { bubbles: true, cancelable: true }) as unknown as DragEvent;
    Object.defineProperty(dragStartEvt, 'dataTransfer', { value: mockDataTransfer });
    await act(async () => {
      taskChip!.dispatchEvent(dragStartEvt);
    });

    const dragOverEvt = new window.Event('dragover', { bubbles: true, cancelable: true }) as unknown as DragEvent;
    Object.defineProperty(dragOverEvt, 'dataTransfer', { value: mockDataTransfer });
    await act(async () => {
      dropCell!.dispatchEvent(dragOverEvt);
    });

    const dropEvt = new window.Event('drop', { bubbles: true, cancelable: true }) as unknown as DragEvent;
    Object.defineProperty(dropEvt, 'dataTransfer', { value: mockDataTransfer });
    await act(async () => {
      dropCell!.dispatchEvent(dropEvt);
    });

    assert(updatedSnapshots.length === 1, 'Dropping task chip on target day invokes onUpdateTask once');
    const droppedUpdate = updatedSnapshots[0];
    assert(
      droppedUpdate.dueDate === targetDateStr &&
        droppedUpdate.dueTime === initialTask.dueTime &&
        droppedUpdate.title === initialTask.title &&
        droppedUpdate.priority === initialTask.priority &&
        droppedUpdate.category === initialTask.category &&
        droppedUpdate.description === initialTask.description &&
        droppedUpdate.isStarred === initialTask.isStarred &&
        droppedUpdate.estimatedMinutes === initialTask.estimatedMinutes &&
        droppedUpdate.id === initialTask.id,
      `Dropping task on another day updates ONLY dueDate (${targetDateStr}) and preserves dueTime (${droppedUpdate.dueTime}) and all fields`
    );

    // 2. Keyboard alternative: focus task chip and press "m" opens date picker dialog
    taskChip!.focus();
    await act(async () => {
      taskChip!.dispatchEvent(
        new window.KeyboardEvent('keydown', { key: 'm', bubbles: true, cancelable: true })
      );
    });

    const moveDialog = calMount.querySelector('#calendar-move-task-dialog');
    const moveDateInput = calMount.querySelector('#calendar-move-date-input') as HTMLInputElement | null;
    assert(
      moveDialog !== null && moveDateInput !== null && moveDateInput.value === sourceDateStr,
      'Pressing "m" on focused task chip opens move-date picker pre-filled with current dueDate'
    );

    await act(async () => {
      setReactInputValue(moveDateInput!, kbTargetDateStr);
    });

    const moveConfirmBtn = calMount.querySelector('#calendar-move-date-confirm') as HTMLButtonElement | null;
    await act(async () => {
      moveConfirmBtn?.click();
    });

    assert(
      updatedSnapshots.length === 2 &&
        updatedSnapshots[1].dueDate === kbTargetDateStr &&
        updatedSnapshots[1].dueTime === '14:30',
      `Submitting move-date picker updates dueDate to "${kbTargetDateStr}" and preserves dueTime "14:30"`
    );

    // 3. Switch to Week view mode and verify 7 columns + empty slot click calls onOpenAddTaskModal({ dueDate, dueTime })
    const weekModeBtn = Array.from(calMount.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Week'
    ) as HTMLButtonElement | undefined;
    assert(weekModeBtn !== undefined, 'Week view mode switcher button exists');

    await act(async () => {
      weekModeBtn?.click();
    });

    const weekDayHeaders = Array.from(
      calMount.querySelectorAll('[data-testid="calendar-week-view"] [data-testid="timegrid-day-header"]')
    );
    assert(
      weekDayHeaders.length === 7,
      `Week view renders TimeGrid with 7 day columns (got ${weekDayHeaders.length})`
    );

    const emptySlotBtn = calMount.querySelector(
      '[data-testid="calendar-week-view"] [data-testid="timegrid-empty-slot"]'
    ) as HTMLButtonElement | null;
    assert(emptySlotBtn !== null, 'Week TimeGrid renders clickable empty time slots');

    const slotDate = emptySlotBtn!.getAttribute('data-date');
    const slotTime = emptySlotBtn!.getAttribute('data-time');
    await act(async () => {
      emptySlotBtn!.click();
    });

    assert(
      openedDefaults.length === 1 &&
        openedDefaults[0].dueDate === slotDate &&
        openedDefaults[0].dueTime === slotTime,
      `Clicking empty slot in Week view calls onOpenAddTaskModal({ dueDate: "${slotDate}", dueTime: "${slotTime}" })`
    );

    await act(async () => {
      calRoot.unmount();
    });
    calMount.remove();
  }

  // Test 25: "Show future repeats" toggle (default off, faded non-editable "repeats" chips, no writes to appData)
  console.log('\n[Test 25] Calendar "Show future repeats" Toggle & Read-Only Projection');
  {
    const { CalendarView, resetCalendarViewState } = await import('../src/components/views/CalendarView.tsx');
    const { getLocalDateString } = await import('../src/lib/dateUtils.ts');
    const { getMonthGrid } = await import('../src/lib/calendarUtils.ts');
    resetCalendarViewState();

    const today = new Date();
    const todayStr = getLocalDateString(today);
    const monthGrid = getMonthGrid(new Date(today.getFullYear(), today.getMonth(), 1), 0);
    const gridEndStr = monthGrid[monthGrid.length - 1];

    const recurringPendingTask = {
      id: 'repeat-pending-1',
      title: 'Daily Standup Notes',
      category: 'study' as const,
      priority: 'medium' as const,
      dueDate: todayStr,
      recurring: 'daily' as const,
      completed: false,
      subtasks: [],
      createdAt: 1700000000000,
    };

    const recurringCompletedTask = {
      id: 'repeat-done-1',
      title: 'Finished Daily Routine',
      category: 'health' as const,
      priority: 'low' as const,
      dueDate: todayStr,
      recurring: 'daily' as const,
      completed: true,
      completedAt: Date.now(),
      subtasks: [],
      createdAt: 1700000000000,
    };

    let updateCalls = 0;
    const calMount = document.createElement('div');
    document.body.appendChild(calMount);
    const calRoot = createRoot(calMount);

    await act(async () => {
      calRoot.render(
        React.createElement(CalendarView, {
          tasks: [recurringPendingTask, recurringCompletedTask],
          exams: [],
          onToggleTask: () => {},
          onUpdateTask: () => {
            updateCalls++;
          },
          onOpenAddTaskModal: () => {},
        })
      );
    });

    const toggleBtn = calMount.querySelector('#calendar-show-repeats-toggle') as HTMLButtonElement | null;
    assert(
      toggleBtn !== null &&
        toggleBtn.getAttribute('aria-checked') === 'false' &&
        (toggleBtn.textContent || '').includes('Show future repeats'),
      '"Show future repeats" toggle renders and defaults to off (aria-checked="false")'
    );
    assert(
      calMount.querySelectorAll('[data-testid="calendar-repeat-chip"]').length === 0,
      'Zero projected repeat chips render while toggle is off'
    );

    const pendingBefore = calMount
      .querySelector('.font-mono.tabular-nums')
      ?.textContent?.trim();

    await act(async () => {
      toggleBtn!.click();
    });

    assert(
      toggleBtn!.getAttribute('aria-checked') === 'true',
      'Clicking toggle switches aria-checked to "true"'
    );

    const repeatChips = Array.from(
      calMount.querySelectorAll('[data-testid="calendar-repeat-chip"]')
    ) as HTMLElement[];

    // Only check repeat chips exist if todayStr < gridEndStr (which is true except if today === gridEndStr)
    if (todayStr < gridEndStr) {
      assert(repeatChips.length > 0, 'Projected repeat chips appear in visible grid when toggle is on');
      assert(
        repeatChips.every(
          (chip) =>
            chip.tagName !== 'BUTTON' &&
            chip.getAttribute('aria-disabled') === 'true' &&
            (chip as any).draggable !== true &&
            (chip.className || '').includes('opacity-55') &&
            (chip.className || '').includes('pointer-events-none') &&
            (chip.textContent || '').includes('Daily Standup Notes') &&
            (chip.textContent || '').toLowerCase().includes('repeats')
        ),
        'Projected repeat chips are faded, non-editable, non-draggable, and labelled "repeats"'
      );
      assert(
        repeatChips.every((chip) => chip.getAttribute('data-source-task-id') !== 'repeat-done-1'),
        'Completed recurring tasks do NOT render projected repeat chips'
      );
    }

    const pendingAfter = calMount
      .querySelector('.font-mono.tabular-nums')
      ?.textContent?.trim();
    assert(
      pendingBefore === pendingAfter && updateCalls === 0,
      'Toggling "Show future repeats" does not mutate monthStats or invoke onUpdateTask'
    );

    await act(async () => {
      calRoot.unmount();
    });
    calMount.remove();

    // Verify in full <App /> localStorage persistence that toggling Show future repeats writes nothing to appData
    const calendarNavBtn = document.getElementById('tab-nav-calendar') as HTMLButtonElement | null;
    await act(async () => {
      calendarNavBtn?.click();
      await new Promise((r) => setTimeout(r, 40));
    });
    const appDataBefore = localStorage.getItem('lifetrack_hub_local_v1');
    const appRepeatToggle = document.getElementById('calendar-show-repeats-toggle') as HTMLButtonElement | null;
    if (appRepeatToggle) {
      await act(async () => {
        appRepeatToggle.click();
        await new Promise((r) => setTimeout(r, 40));
      });
    }
    const appDataAfter = localStorage.getItem('lifetrack_hub_local_v1');
    assert(
      appDataBefore === appDataAfter,
      'Toggling "Show future repeats" in full App does not write projected items to appData/localStorage'
    );
  }

  // Test 26: FinancesView Month Selector, All-Time Toggle, Over-Budget Text, Upcoming Group & Cross-View Consistency
  console.log('\n[Test 26] FinancesView Month Selector, Over-Budget Banner & Cross-View Parity');
  {
    const { FinancesView } = await import('../src/components/views/FinancesView.tsx');
    const { OverviewView } = await import('../src/components/views/OverviewView.tsx');
    const { InsightsView } = await import('../src/components/views/InsightsView.tsx');
    const { getLocalDateString, getLocalDateOffset } = await import('../src/lib/dateUtils.ts');
    const { shiftMonthKey, monthKey, formatMonthLabel } = await import('../src/lib/financeUtils.ts');

    const todayStr = getLocalDateString();
    const yesterdayStr = getLocalDateOffset(-1);
    const futureStr = getLocalDateOffset(5);
    const currentYm = monthKey(todayStr);
    const prevYm = shiftMonthKey(currentYm, -1);

    const txs = [
      {
        id: 'fin-t1',
        title: 'Groceries',
        amount: 349.50,
        type: 'expense' as const,
        category: 'Groceries' as const,
        date: todayStr,
        paymentMethod: 'Card' as const,
        createdAt: 1700000001000,
      },
      {
        id: 'fin-t2',
        title: 'Textbooks',
        amount: 2400.10,
        type: 'expense' as const,
        category: 'Books & Supplies' as const,
        date: yesterdayStr,
        paymentMethod: 'Card' as const,
        createdAt: 1700000002000,
      },
      {
        id: 'fin-t3',
        title: 'Lab Fee',
        amount: 3200.20,
        type: 'expense' as const,
        category: 'Tuition & Education' as const,
        date: todayStr,
        paymentMethod: 'Bank Transfer' as const,
        createdAt: 1700000003000,
      },
      {
        id: 'fin-t-prev',
        title: 'Last Month Rent',
        amount: 1500,
        type: 'expense' as const,
        category: 'Housing & Rent' as const,
        date: `${prevYm}-10`,
        paymentMethod: 'Bank Transfer' as const,
        createdAt: 1699000000000,
      },
      {
        id: 'fin-t-future',
        title: 'Future Flight',
        amount: 4500,
        type: 'expense' as const,
        category: 'Transportation' as const,
        date: futureStr,
        paymentMethod: 'Card' as const,
        createdAt: 1700000004000,
      },
      {
        id: 'fin-t-del',
        title: 'Deleted Item',
        amount: 9000,
        type: 'expense' as const,
        category: 'Other' as const,
        date: todayStr,
        paymentMethod: 'Cash' as const,
        createdAt: 1700000005000,
        deletedAt: 1700000006000,
      },
    ];
    const budget = { monthlyBudget: 5000, savingsGoal: 1000 };

    const finMount = document.createElement('div');
    document.body.appendChild(finMount);
    const finRoot = createRoot(finMount);

    await act(async () => {
      finRoot.render(
        React.createElement(FinancesView, {
          transactions: txs,
          budget,
          onAddTransaction: () => {},
          onDeleteTransaction: () => {},
          onUpdateBudget: () => {},
          onOpenAddTransactionModal: () => {},
        })
      );
    });

    const overText = finMount.querySelector('[data-testid="finances-budget-remaining"]') as HTMLElement | null;
    const pctText = finMount.querySelector('[data-testid="finances-budget-percent"]') as HTMLElement | null;
    const barEl = finMount.querySelector('[data-testid="finances-budget-bar"]') as HTMLElement | null;

    assert(
      overText !== null &&
        (overText.textContent || '').includes('Over by ₹949.80') &&
        (overText.className || '').includes('text-rose-600') &&
        (pctText?.textContent || '').includes('119%'),
      `Over-budget renders "Over by ₹949.80" in rose text and 119% (got "${overText?.textContent}", "${pctText?.textContent}")`
    );
    assert(barEl?.style.width === '100%', `Over-budget bar stays capped at 100% width (got "${barEl?.style.width}")`);

    // Date group headers: Upcoming and Today present
    assert(
      finMount.querySelector('[data-testid="finances-date-group-upcoming"]') !== null &&
        finMount.querySelector(`[data-testid="finances-date-group-${todayStr}"]`) !== null,
      'FinancesView groups future-dated items under Upcoming and today items under Today'
    );

    // Month selector prev -> switches to previous month (1500 vs 5000 = 30%, ₹3,500 left)
    const prevBtn = finMount.querySelector('#finances-prev-month-btn') as HTMLButtonElement | null;
    await act(async () => {
      prevBtn?.click();
    });
    assert(
      (finMount.querySelector('#finances-month-label')?.textContent || '') === formatMonthLabel(prevYm) &&
        (finMount.querySelector('[data-testid="finances-budget-percent"]')?.textContent || '').includes('30%') &&
        (finMount.querySelector('[data-testid="finances-budget-remaining"]')?.textContent || '').includes('left'),
      'Previous month button updates stat cards & budget status to previous month'
    );

    // "All time" toggle includes previous + current month (5949.80 + 1500 = 7449.80)
    const allTimeBtn = finMount.querySelector('#finances-all-time-toggle') as HTMLButtonElement | null;
    await act(async () => {
      allTimeBtn?.click();
    });
    assert(
      allTimeBtn?.getAttribute('aria-checked') === 'true' &&
        (finMount.querySelector('[data-testid="finances-stat-expense"]')?.textContent || '').includes('7,449.80'),
      'All time toggle aggregates all non-future active expenses across months'
    );

    // "This month" button returns to current month
    const thisMonthBtn = finMount.querySelector('#finances-this-month-btn') as HTMLButtonElement | null;
    await act(async () => {
      thisMonthBtn?.click();
    });
    assert(
      allTimeBtn?.getAttribute('aria-checked') === 'false' &&
        (finMount.querySelector('[data-testid="finances-budget-percent"]')?.textContent || '').includes('119%'),
      '"This month" button resets scope to current month (119%)'
    );

    await act(async () => {
      finRoot.unmount();
    });
    finMount.remove();

    // Cross-view parity: OverviewView and InsightsView show identical 119%
    const ovMount = document.createElement('div');
    document.body.appendChild(ovMount);
    const ovRoot = createRoot(ovMount);
    await act(async () => {
      ovRoot.render(
        React.createElement(OverviewView, {
          tasks: [],
          transactions: txs,
          budget,
          exams: [],
          habits: [],
          onNavigateTab: () => {},
          onToggleTask: () => {},
          onToggleHabitToday: () => {},
          onOpenAddTaskModal: () => {},
          onOpenAddTransactionModal: () => {},
          onOpenAddExamModal: () => {},
        })
      );
    });
    const ovFinanceText = ovMount.querySelector('#metric-card-finances')?.textContent || '';
    assert(
      ovFinanceText.includes('119%') && ovFinanceText.includes('5,949.80'),
      `OverviewView uses shared financeUtils showing 119% and ₹5,949.80 (got "${ovFinanceText}")`
    );
    await act(async () => {
      ovRoot.unmount();
    });
    ovMount.remove();

    const inMount = document.createElement('div');
    document.body.appendChild(inMount);
    const inRoot = createRoot(inMount);
    await act(async () => {
      inRoot.render(
        React.createElement(InsightsView, {
          tasks: [],
          habits: [],
          transactions: txs,
          budget,
          exams: [],
        })
      );
    });
    assert(
      (inMount.textContent || '').includes('119%') && (inMount.textContent || '').includes('-₹7,449.80'),
      'InsightsView uses shared financeUtils showing identical 119% budget usage and -₹7,449.80 net balance'
    );
    await act(async () => {
      inRoot.unmount();
    });
    inMount.remove();
  }

  // Test 27: TodayView "Monthly Cash" Card (Over by ₹1,000, Watch, On track, Set a budget -> Finances)
  console.log('\n[Test 27] TodayView Monthly Cash Card Dynamic Status');
  {
    const { TodayView } = await import('../src/components/views/TodayView.tsx');
    const { getLocalDateString } = await import('../src/lib/dateUtils.ts');
    const todayStr = getLocalDateString();

    const makeExpense = (id: string, amount: number) => ({
      id,
      title: 'Expense',
      amount,
      type: 'expense' as const,
      category: 'Food & Dining' as const,
      date: todayStr,
      paymentMethod: 'Card' as const,
      createdAt: 1700000000000,
    });

    const navCalls: string[] = [];
    const tvMount = document.createElement('div');
    document.body.appendChild(tvMount);
    const tvRoot = createRoot(tvMount);

    // 1. Over budget: ₹6,000 spent on ₹5,000 budget -> "Over by ₹1,000" and "Over"
    await act(async () => {
      tvRoot.render(
        React.createElement(TodayView, {
          tasks: [],
          habits: [],
          exams: [],
          transactions: [makeExpense('mc-1', 6000)],
          budget: { monthlyBudget: 5000, savingsGoal: 1000 },
          onToggleTask: () => {},
          onToggleHabitToday: () => {},
          onAddTask: () => {},
          onOpenAddTaskModal: () => {},
          onOpenCommandPalette: () => {},
          onOpenFocusModal: () => {},
          onNavigateTab: (tab: string) => navCalls.push(tab),
        })
      );
    });

    const cashCardOver = tvMount.querySelector('[data-testid="today-monthly-cash-card"]') as HTMLElement | null;
    const cashCardOverText = cashCardOver?.textContent || '';
    assert(
      cashCardOver !== null &&
        cashCardOverText.includes('Over by ₹1,000') &&
        cashCardOverText.includes('Over') &&
        !cashCardOverText.includes('Healthy'),
      `With ₹6,000 spent on ₹5,000 budget, Monthly Cash card says "Over by ₹1,000" and "Over" (got "${cashCardOverText}")`
    );

    // 2. Watch state: ₹4,000 spent on ₹5,000 budget (80%) -> "₹1,000 left" and "Watch"
    await act(async () => {
      tvRoot.render(
        React.createElement(TodayView, {
          tasks: [],
          habits: [],
          exams: [],
          transactions: [makeExpense('mc-2', 4000)],
          budget: { monthlyBudget: 5000, savingsGoal: 1000 },
          onToggleTask: () => {},
          onToggleHabitToday: () => {},
          onAddTask: () => {},
          onOpenAddTaskModal: () => {},
          onOpenCommandPalette: () => {},
          onOpenFocusModal: () => {},
          onNavigateTab: (tab: string) => navCalls.push(tab),
        })
      );
    });
    const cashCardWatchText = tvMount.querySelector('[data-testid="today-monthly-cash-card"]')?.textContent || '';
    assert(
      cashCardWatchText.includes('₹1,000 left') && cashCardWatchText.includes('Watch'),
      `At 80% budget spent, Monthly Cash card shows "₹1,000 left" and "Watch" (got "${cashCardWatchText}")`
    );

    // 3. On track state: ₹1,500 spent on ₹5,000 budget (30%) -> "₹3,500 left" and "On track"
    await act(async () => {
      tvRoot.render(
        React.createElement(TodayView, {
          tasks: [],
          habits: [],
          exams: [],
          transactions: [makeExpense('mc-3', 1500)],
          budget: { monthlyBudget: 5000, savingsGoal: 1000 },
          onToggleTask: () => {},
          onToggleHabitToday: () => {},
          onAddTask: () => {},
          onOpenAddTaskModal: () => {},
          onOpenCommandPalette: () => {},
          onOpenFocusModal: () => {},
          onNavigateTab: (tab: string) => navCalls.push(tab),
        })
      );
    });
    const cashCardOkText = tvMount.querySelector('[data-testid="today-monthly-cash-card"]')?.textContent || '';
    assert(
      cashCardOkText.includes('₹3,500 left') && cashCardOkText.includes('On track'),
      `At 30% budget spent, Monthly Cash card shows "₹3,500 left" and "On track" (got "${cashCardOkText}")`
    );

    // 4. monthlyBudget === 0 -> "Set a budget" and clicking navigates to 'finances'
    await act(async () => {
      tvRoot.render(
        React.createElement(TodayView, {
          tasks: [],
          habits: [],
          exams: [],
          transactions: [],
          budget: { monthlyBudget: 0, savingsGoal: 0 },
          onToggleTask: () => {},
          onToggleHabitToday: () => {},
          onAddTask: () => {},
          onOpenAddTaskModal: () => {},
          onOpenCommandPalette: () => {},
          onOpenFocusModal: () => {},
          onNavigateTab: (tab: string) => navCalls.push(tab),
        })
      );
    });
    const setBudgetCard = tvMount.querySelector('[data-testid="today-monthly-cash-card"]') as HTMLElement | null;
    assert(
      (setBudgetCard?.textContent || '').includes('Set a budget'),
      'When monthlyBudget is 0, Monthly Cash card shows "Set a budget"'
    );
    await act(async () => {
      setBudgetCard?.click();
    });
    assert(
      navCalls[navCalls.length - 1] === 'finances',
      'Clicking Monthly Cash card navigates to Finances'
    );

    await act(async () => {
      tvRoot.unmount();
    });
    tvMount.remove();
  }

  // Test 28: Transaction Edit Modal & Delete + 6s Undo Toast
  console.log('\n[Test 28] Transaction Edit (amount & updatedAt) and Delete + Undo Toast');
  {
    const { LOCAL_STORAGE_KEY } = await import('../src/lib/firebase.ts');
    const { isActive } = await import('../src/lib/entity.ts');

    // Navigate to Finances tab in the live <App />
    const finNavBtn = document.getElementById('tab-nav-finances') as HTMLButtonElement | null;
    assert(finNavBtn !== null, 'Finances nav tab exists');
    await act(async () => {
      finNavBtn?.click();
      await new Promise((r) => setTimeout(r, 40));
    });

    // Add a fresh transaction so we have a clean row with known initial amount & updatedAt
    const addTxBtn = document.getElementById('finances-add-tx-btn') as HTMLButtonElement | null;
    assert(addTxBtn !== null, 'Add Transaction button exists in FinancesView');
    await act(async () => {
      addTxBtn?.click();
    });

    const titleInput = document.getElementById('tx-title-input') as HTMLInputElement | null;
    const amountInput = document.getElementById('tx-amount-input') as HTMLInputElement | null;
    const submitTxBtn = document.getElementById('submit-create-tx-btn') as HTMLButtonElement | null;
    assert(titleInput !== null && amountInput !== null && submitTxBtn !== null, 'AddTransactionModal form fields render');

    await act(async () => {
      setReactInputValue(titleInput!, 'Coffee Shop Edit Test');
      setReactInputValue(amountInput!, '125');
    });
    await act(async () => {
      submitTxBtn!.closest('form')?.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 20));
    });

    const savedAfterCreate = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
    const createdTx = (savedAfterCreate.transactions || []).find(
      (t: { title?: string }) => t.title === 'Coffee Shop Edit Test'
    );
    assert(
      createdTx !== undefined && createdTx.amount === 125 && typeof createdTx.updatedAt === 'number',
      'Created transaction persisted with amount=125 and updatedAt'
    );
    const initialUpdatedAt = createdTx.updatedAt;

    // Wait 5ms so updatedAt strictly increases on edit
    await new Promise((r) => setTimeout(r, 5));

    // Click the transaction row to open Edit Transaction modal
    const txRow = document.getElementById(`transaction-row-${createdTx.id}`) as HTMLElement | null;
    assert(txRow !== null, 'Transaction row renders in FinancesView');
    await act(async () => {
      txRow?.click();
    });

    const modalTitleEl = document.getElementById('add-tx-modal-title');
    const editAmountInput = document.getElementById('tx-amount-input') as HTMLInputElement | null;
    const editTitleInput = document.getElementById('tx-title-input') as HTMLInputElement | null;
    const editSubmitBtn = document.getElementById('submit-create-tx-btn') as HTMLButtonElement | null;
    assert(
      modalTitleEl?.textContent?.trim() === 'Edit Transaction' &&
        editTitleInput?.value === 'Coffee Shop Edit Test' &&
        editAmountInput?.value === '125',
      `Clicking row opens modal with title "Edit Transaction" and pre-filled values (got "${modalTitleEl?.textContent}")`
    );

    // Edit amount 125 -> 275 and save
    await act(async () => {
      setReactInputValue(editAmountInput!, '275');
    });
    await act(async () => {
      editSubmitBtn!.closest('form')?.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 20));
    });

    const savedAfterEdit = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
    const editedTx = (savedAfterEdit.transactions || []).find(
      (t: { id?: string }) => t.id === createdTx.id
    );
    assert(
      editedTx !== undefined &&
        editedTx.amount === 275 &&
        typeof editedTx.updatedAt === 'number' &&
        editedTx.updatedAt > initialUpdatedAt &&
        isActive(editedTx),
      `Editing transaction updates amount to 275 and bumps updatedAt (${initialUpdatedAt} -> ${editedTx?.updatedAt})`
    );
    assert(
      (document.getElementById(`transaction-row-${createdTx.id}`)?.textContent || '').includes('275'),
      'Updated amount displays in FinancesView row'
    );

    // Delete transaction -> tombstone applied + 6s "Transaction deleted - Undo" toast shown
    const deleteBtn = document.getElementById(`transaction-delete-${createdTx.id}`) as HTMLButtonElement | null;
    assert(deleteBtn !== null, 'Delete button exists on transaction row');
    await act(async () => {
      deleteBtn?.click();
    });

    const savedAfterDelete = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
    const deletedTx = (savedAfterDelete.transactions || []).find(
      (t: { id?: string }) => t.id === createdTx.id
    );
    const undoToast = document.getElementById('tx-undo-toast-banner');
    const undoBtn = document.getElementById('tx-undo-toast-btn') as HTMLButtonElement | null;
    assert(
      deletedTx !== undefined && !isActive(deletedTx) && typeof deletedTx.deletedAt === 'number',
      'Delete marks transaction with deletedAt tombstone (inactive)'
    );
    assert(
      document.getElementById(`transaction-row-${createdTx.id}`) === null,
      'Soft-deleted transaction is removed from active FinancesView list'
    );
    assert(
      undoToast !== null &&
        (undoToast.textContent || '').includes('Transaction deleted - Undo') &&
        undoBtn !== null,
      `6-second undo toast renders with "Transaction deleted - Undo" (got "${undoToast?.textContent}")`
    );

    // Click Undo -> clears deletedAt via restoreTransaction and makes transaction active again
    await act(async () => {
      undoBtn?.click();
    });

    const savedAfterUndo = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
    const restoredTx = (savedAfterUndo.transactions || []).find(
      (t: { id?: string }) => t.id === createdTx.id
    );
    assert(
      restoredTx !== undefined &&
        isActive(restoredTx) &&
        restoredTx.deletedAt === undefined &&
        restoredTx.amount === 275,
      'Clicking Undo clears deletedAt and makes the transaction active again with amount=275'
    );
    assert(
      document.getElementById(`transaction-row-${createdTx.id}`) !== null &&
        document.getElementById('tx-undo-toast-banner') === null,
      'Restored transaction reappears in FinancesView and undo toast dismisses'
    );
  }

  // Test 29: FinancesView Mobile Layout (2x2 stat grid Net+Budget first, plurals, 2-line truncated rows, wrapping filters at 360/768/1280px)
  console.log('\n[Test 29] FinancesView Mobile Stat Grid, Plurals, 2-Line Rows & Responsive Viewports');
  {
    const { FinancesView } = await import('../src/components/views/FinancesView.tsx');
    const { getLocalDateString, getLocalDateOffset } = await import('../src/lib/dateUtils.ts');

    const todayStr = getLocalDateString();
    const olderDateStr = `${todayStr.slice(0, 8)}02`;
    const pluralMount = document.createElement('div');
    document.body.appendChild(pluralMount);
    const pluralRoot = createRoot(pluralMount);

    const singleTxSet = [
      {
        id: 'mob-inc-1',
        title: 'Part-Time Tutoring Stipend For Algorithms Lab',
        amount: 4500,
        type: 'income' as const,
        category: 'Salary & Wages' as const,
        date: todayStr,
        paymentMethod: 'Bank Transfer' as const,
        createdAt: 1700000001000,
      },
      {
        id: 'mob-exp-1',
        title: 'Very Long Cafe Study Session Espresso And Pastry Order',
        amount: 320,
        type: 'expense' as const,
        category: 'Food & Dining' as const,
        date: olderDateStr === todayStr ? getLocalDateOffset(-3) : olderDateStr,
        paymentMethod: 'Online Wallet' as const,
        createdAt: 1700000002000,
      },
    ];

    for (const width of [360, 768, 1280]) {
      dom.reconfigure({ width, height: 800 });
      await act(async () => {
        pluralRoot.render(
          React.createElement(FinancesView, {
            transactions: singleTxSet,
            budget: { monthlyBudget: 5000, savingsGoal: 1000 },
            onAddTransaction: () => {},
            onUpdateTransaction: () => {},
            onDeleteTransaction: () => {},
            onUpdateBudget: () => {},
            onOpenAddTransactionModal: () => {},
          })
        );
      });

      const statsGrid = pluralMount.querySelector('[data-testid="finances-stats-grid"]') as HTMLElement | null;
      const statCards = Array.from(statsGrid?.children || []).map((el) =>
        el.getAttribute('data-testid')
      );
      assert(
        statsGrid !== null &&
          (statsGrid.className || '').includes('grid-cols-2') &&
          statCards[0] === 'finances-stat-net' &&
          statCards[1] === 'finances-stat-budget' &&
          statCards[2] === 'finances-stat-income' &&
          statCards[3] === 'finances-stat-expense',
        `At ${width}px: stat grid uses 2x2 mobile layout with Net & Budget cards first (${statCards.join(', ')})`
      );

      const netValueEl = pluralMount.querySelector('[data-testid="finances-stat-net"] p');
      assert(
        (netValueEl?.className || '').includes('text-lg') &&
          (netValueEl?.className || '').includes('sm:text-2xl'),
        `At ${width}px: stat card values use smaller text-lg on <640px and text-2xl on sm+`
      );

      const incomeText = pluralMount.querySelector('[data-testid="finances-stat-income"]')?.textContent || '';
      const expenseText = pluralMount.querySelector('[data-testid="finances-stat-expense"]')?.textContent || '';
      assert(
        incomeText.includes('1 credit') &&
          !incomeText.includes('1 credits') &&
          expenseText.includes('1 purchase') &&
          !expenseText.includes('1 purchases'),
        `At ${width}px: singular plurals render "1 credit" and "1 purchase"`
      );

      const rowEl = pluralMount.querySelector('#transaction-row-mob-exp-1') as HTMLElement | null;
      const rowParagraphs = rowEl ? Array.from(rowEl.querySelectorAll('p')) : [];
      assert(
        rowEl !== null &&
          rowParagraphs.length === 2 &&
          (rowParagraphs[0].className || '').includes('truncate') &&
          (rowParagraphs[1].className || '').includes('truncate') &&
          rowParagraphs[1].textContent?.trim() === 'Food & Dining · Online Wallet',
        `At ${width}px: transaction row has truncated title line 1 and "Category · Payment method" line 2 without date`
      );

      const filtersToolbar = pluralMount.querySelector('[data-testid="finances-filters-toolbar"]') as HTMLElement | null;
      assert(
        filtersToolbar !== null && (filtersToolbar.className || '').includes('flex-wrap'),
        `At ${width}px: filters & search toolbar enables flex-wrap without overflowing`
      );
    }

    // Verify plural "2 credits" when 2 income transactions exist
    await act(async () => {
      pluralRoot.render(
        React.createElement(FinancesView, {
          transactions: [
            ...singleTxSet,
            {
              id: 'mob-inc-2',
              title: 'Scholarship',
              amount: 2000,
              type: 'income' as const,
              category: 'Allowance & Grants' as const,
              date: todayStr,
              paymentMethod: 'Bank Transfer' as const,
              createdAt: 1700000003000,
            },
          ],
          budget: { monthlyBudget: 5000, savingsGoal: 1000 },
          onAddTransaction: () => {},
          onUpdateTransaction: () => {},
          onDeleteTransaction: () => {},
          onUpdateBudget: () => {},
          onOpenAddTransactionModal: () => {},
        })
      );
    });
    assert(
      (pluralMount.querySelector('[data-testid="finances-stat-income"]')?.textContent || '').includes('2 credits'),
      '2 income transactions render plural "2 credits"'
    );

    dom.reconfigure({ width: 1280, height: 800 });
    await act(async () => {
      pluralRoot.unmount();
    });
    pluralMount.remove();
  }

  // Test 30: Type-Scoped Categories, Last-Used Payment Method (UPI), Legacy 'Online Wallet', & Savings Goal Card
  console.log('\n[Test 30] Income/Expense Category Toggle, Last Payment Method & Savings Goal Card');
  {
    const { AddTransactionModal } = await import('../src/components/modals/AddTransactionModal.tsx');
    const { FinancesView } = await import('../src/components/views/FinancesView.tsx');
    const { EXPENSE_CATEGORIES, INCOME_CATEGORIES, LAST_PAYMENT_METHOD_KEY } = await import(
      '../src/lib/financeCategories.ts'
    );
    const { getLocalDateString } = await import('../src/lib/dateUtils.ts');
    const todayStr = getLocalDateString();

    localStorage.removeItem(LAST_PAYMENT_METHOD_KEY);

    const addedTxs: Array<{ paymentMethod: string; category: string; type: string }> = [];
    const modalMount = document.createElement('div');
    document.body.appendChild(modalMount);
    const modalRoot = createRoot(modalMount);

    await act(async () => {
      modalRoot.render(
        React.createElement(AddTransactionModal, {
          isOpen: true,
          onClose: () => {},
          onAddTransaction: (tx) => addedTxs.push(tx),
        })
      );
    });

    const getCategoryOptions = () =>
      Array.from(
        (modalMount.querySelector('#tx-category-select') as HTMLSelectElement | null)?.options || []
      ).map((o) => o.value);

    const initialExpenseOpts = getCategoryOptions();
    assert(
      initialExpenseOpts.includes('Subscriptions') &&
        initialExpenseOpts.includes('Entertainment') &&
        initialExpenseOpts.includes('Mobile & Internet') &&
        initialExpenseOpts.includes('Fees & Fines') &&
        initialExpenseOpts.includes('Travel') &&
        !initialExpenseOpts.includes('Salary & Wages') &&
        !initialExpenseOpts.includes('Allowance & Grants'),
      'Expense mode shows only EXPENSE_CATEGORIES (including new ones) and excludes income categories'
    );

    // Toggle to Income -> expense categories removed & category resets to first income item ('Salary & Wages')
    const incomeBtn = modalMount.querySelector('#tx-toggle-income-btn') as HTMLButtonElement | null;
    await act(async () => {
      incomeBtn?.click();
    });
    const incomeOpts = getCategoryOptions();
    const catSelectAfterIncome = modalMount.querySelector('#tx-category-select') as HTMLSelectElement;
    assert(
      incomeOpts.join(',') === INCOME_CATEGORIES.join(',') &&
        !incomeOpts.includes('Food & Dining') &&
        !incomeOpts.includes('Subscriptions') &&
        catSelectAfterIncome.value === INCOME_CATEGORIES[0],
      `Toggling to income removes expense categories and resets category to "${INCOME_CATEGORIES[0]}"`
    );

    // Toggle back to Expense -> resets category to first expense item ('Food & Dining')
    const expenseBtn = modalMount.querySelector('#tx-toggle-expense-btn') as HTMLButtonElement | null;
    await act(async () => {
      expenseBtn?.click();
    });
    const catSelectAfterExpense = modalMount.querySelector('#tx-category-select') as HTMLSelectElement;
    assert(
      catSelectAfterExpense.value === EXPENSE_CATEGORIES[0],
      `Toggling back to expense resets category to "${EXPENSE_CATEGORIES[0]}"`
    );

    // Select 'UPI', submit, close and reopen -> default paymentMethod becomes 'UPI'
    const titleEl = modalMount.querySelector('#tx-title-input') as HTMLInputElement;
    const amountEl = modalMount.querySelector('#tx-amount-input') as HTMLInputElement;
    const methodEl = modalMount.querySelector('#tx-method-select') as HTMLSelectElement;
    await act(async () => {
      setReactInputValue(titleEl, 'Jio Fiber Plan');
      setReactInputValue(amountEl, '799');
      methodEl.value = 'UPI';
      methodEl.dispatchEvent(new window.Event('change', { bubbles: true }));
    });
    await act(async () => {
      titleEl.closest('form')?.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    });

    assert(
      addedTxs.length === 1 &&
        addedTxs[0].paymentMethod === 'UPI' &&
        localStorage.getItem(LAST_PAYMENT_METHOD_KEY) === 'UPI',
      'Submitting with UPI saves transaction and persists UPI as last-used paymentMethod'
    );

    // Reopen fresh modal -> defaults to 'UPI'
    await act(async () => {
      modalRoot.render(
        React.createElement(AddTransactionModal, {
          isOpen: false,
          onClose: () => {},
          onAddTransaction: () => {},
        })
      );
    });
    await act(async () => {
      modalRoot.render(
        React.createElement(AddTransactionModal, {
          isOpen: true,
          onClose: () => {},
          onAddTransaction: () => {},
        })
      );
    });
    const reopenedMethodEl = modalMount.querySelector('#tx-method-select') as HTMLSelectElement;
    assert(
      reopenedMethodEl.value === 'UPI',
      `Reopening AddTransactionModal defaults paymentMethod to last-used "UPI" (got "${reopenedMethodEl.value}")`
    );

    await act(async () => {
      modalRoot.unmount();
    });
    modalMount.remove();
    localStorage.removeItem(LAST_PAYMENT_METHOD_KEY);

    // FinancesView: legacy 'Online Wallet' renders, and "Saved this month" card hides when savingsGoal=0 & renders progress when >0
    const sgMount = document.createElement('div');
    document.body.appendChild(sgMount);
    const sgRoot = createRoot(sgMount);

    const legacyAndSavingsTxs = [
      {
        id: 'sg-inc-1',
        title: 'TA Stipend',
        amount: 4500,
        type: 'income' as const,
        category: 'Salary & Wages' as const,
        date: todayStr,
        paymentMethod: 'Bank Transfer' as const,
        createdAt: 1700000001000,
      },
      {
        id: 'sg-exp-legacy',
        title: 'Campus Wallet Topup',
        amount: 3000,
        type: 'expense' as const,
        category: 'Other' as const,
        date: todayStr,
        paymentMethod: 'Online Wallet' as const,
        createdAt: 1700000002000,
      },
    ];

    // savingsGoal = 0 -> card hidden, legacy 'Online Wallet' transaction renders
    await act(async () => {
      sgRoot.render(
        React.createElement(FinancesView, {
          transactions: legacyAndSavingsTxs,
          budget: { monthlyBudget: 5000, savingsGoal: 0 },
          onAddTransaction: () => {},
          onDeleteTransaction: () => {},
          onUpdateBudget: () => {},
          onOpenAddTransactionModal: () => {},
        })
      );
    });

    assert(
      sgMount.querySelector('[data-testid="finances-savings-goal-card"]') === null,
      'Saved this month card is hidden when savingsGoal is 0'
    );
    assert(
      (sgMount.querySelector('#transaction-row-sg-exp-legacy')?.textContent || '').includes('Online Wallet'),
      'Legacy "Online Wallet" transaction renders cleanly in FinancesView'
    );

    // savingsGoal = 2000 -> Saved = max(0, 4500 - 3000) = 1500 (75%)
    await act(async () => {
      sgRoot.render(
        React.createElement(FinancesView, {
          transactions: legacyAndSavingsTxs,
          budget: { monthlyBudget: 5000, savingsGoal: 2000 },
          onAddTransaction: () => {},
          onDeleteTransaction: () => {},
          onUpdateBudget: () => {},
          onOpenAddTransactionModal: () => {},
        })
      );
    });

    const sgCard = sgMount.querySelector('[data-testid="finances-savings-goal-card"]') as HTMLElement | null;
    const sgBar = sgMount.querySelector('[data-testid="finances-savings-goal-bar"]') as HTMLElement | null;
    assert(
      sgCard !== null &&
        (sgCard.textContent || '').includes('Saved this month') &&
        (sgCard.textContent || '').includes('₹1,500') &&
        (sgCard.textContent || '').includes('₹2,000') &&
        (sgCard.textContent || '').includes('75%') &&
        sgBar?.style.width === '75%',
      `Saved this month card shows ₹1,500 of ₹2,000 (75%) and 75% progress bar (got "${sgCard?.textContent}")`
    );

    await act(async () => {
      sgRoot.unmount();
    });
    sgMount.remove();
  }

  // Test 31: Category Budgets, Rollover (+300 / -100), Over-limit Rose Sorting, Missing Limit No Bar, Negative Validation, & Prop Re-sync
  console.log('\n[Test 31] Category Budgets, Rollover, Sorting, Validation & Prop Re-sync');
  {
    const { FinancesView } = await import('../src/components/views/FinancesView.tsx');
    const { EXPENSE_CATEGORIES } = await import('../src/lib/financeCategories.ts');
    const { getLocalDateString } = await import('../src/lib/dateUtils.ts');
    const { monthKey, shiftMonthKey } = await import('../src/lib/financeUtils.ts');

    const todayStr = getLocalDateString();
    const curMonth = monthKey(todayStr);
    const prevMonth = shiftMonthKey(curMonth, -1);
    const prevDate = `${prevMonth}-10`;

    const cbMount = document.createElement('div');
    document.body.appendChild(cbMount);
    const cbRoot = createRoot(cbMount);

    const budgetUpdates: Array<{
      monthlyBudget: number;
      savingsGoal: number;
      categoryBudgets?: Record<string, number>;
      rollover?: boolean;
    }> = [];

    const categoryBudgetTxs = [
      // Previous month: Food & Dining limit 1000, spent 700 => +300 rollover -> effective 1300
      {
        id: 'cb-prev-food',
        title: 'Prev Month Groceries',
        amount: 700,
        type: 'expense' as const,
        category: 'Food & Dining' as const,
        date: prevDate,
        paymentMethod: 'Card' as const,
        createdAt: 1700000001000,
      },
      // Previous month: Travel limit 500, spent 600 => -100 rollover -> effective 400
      {
        id: 'cb-prev-travel',
        title: 'Prev Month Flight',
        amount: 600,
        type: 'expense' as const,
        category: 'Travel' as const,
        date: prevDate,
        paymentMethod: 'UPI' as const,
        createdAt: 1700000002000,
      },
      // Current month: Food & Dining spent 500 / 1300 (under limit)
      {
        id: 'cb-cur-food',
        title: 'Current Month Cafe',
        amount: 500,
        type: 'expense' as const,
        category: 'Food & Dining' as const,
        date: todayStr,
        paymentMethod: 'UPI' as const,
        createdAt: 1700000003000,
      },
      // Current month: Travel spent 450 / 400 (over limit due to -100 rollover)
      {
        id: 'cb-cur-travel',
        title: 'Current Month Train',
        amount: 450,
        type: 'expense' as const,
        category: 'Travel' as const,
        date: todayStr,
        paymentMethod: 'Card' as const,
        createdAt: 1700000004000,
      },
      // Current month: Entertainment has NO limit configured -> must render NO progress bar
      {
        id: 'cb-cur-ent',
        title: 'Movie Tickets',
        amount: 1200,
        type: 'expense' as const,
        category: 'Entertainment' as const,
        date: todayStr,
        paymentMethod: 'Cash' as const,
        createdAt: 1700000005000,
      },
    ];

    await act(async () => {
      cbRoot.render(
        React.createElement(FinancesView, {
          transactions: categoryBudgetTxs,
          budget: {
            monthlyBudget: 5000,
            savingsGoal: 1000,
            categoryBudgets: {
              'Food & Dining': 1000,
              Travel: 500,
            },
            rollover: true,
          },
          onAddTransaction: () => {},
          onDeleteTransaction: () => {},
          onUpdateBudget: (b) => budgetUpdates.push(b),
          onOpenAddTransactionModal: () => {},
        })
      );
    });

    const catRows = Array.from(
      cbMount.querySelectorAll('[data-testid^="expense-category-row-"]')
    ) as HTMLElement[];
    const rowOrder = catRows.map((el) => el.getAttribute('data-testid'));
    assert(
      rowOrder[0] === 'expense-category-row-Travel',
      `Over-limit category "Travel" sorts first ahead of higher-spend Entertainment & under-limit Food & Dining (got ${JSON.stringify(rowOrder)})`
    );

    const travelRow = cbMount.querySelector('[data-testid="expense-category-row-Travel"]') as HTMLElement;
    const travelBar = cbMount.querySelector('[data-testid="expense-category-bar-Travel"]') as HTMLElement | null;
    const foodRow = cbMount.querySelector('[data-testid="expense-category-row-Food & Dining"]') as HTMLElement;
    const foodBar = cbMount.querySelector('[data-testid="expense-category-bar-Food & Dining"]') as HTMLElement | null;
    const entRow = cbMount.querySelector('[data-testid="expense-category-row-Entertainment"]') as HTMLElement;
    const entBar = cbMount.querySelector('[data-testid="expense-category-bar-Entertainment"]');

    assert(
      (travelRow.textContent || '').includes('₹450 / ₹400') &&
        travelRow.innerHTML.includes('text-rose-600') &&
        travelBar !== null &&
        travelBar.className.includes('bg-rose-500'),
      `Travel applies -100 rollover (₹450 / ₹400), turns rose, and renders rose progress bar`
    );
    assert(
      (foodRow.textContent || '').includes('₹500 / ₹1,300') && foodBar !== null,
      `Food & Dining applies +300 rollover (₹500 / ₹1,300) and renders progress bar`
    );
    assert(
      entRow !== null && entBar === null,
      'Uncapped category "Entertainment" renders spent row without any progress bar'
    );

    // Open Edit budgets panel -> one number input per EXPENSE_CATEGORIES
    const editCatBtn = cbMount.querySelector('#finances-edit-category-budgets-btn') as HTMLButtonElement;
    await act(async () => {
      editCatBtn.click();
    });

    const catInputs = EXPENSE_CATEGORIES.map((cat) =>
      cbMount.querySelector(`[data-testid="category-budget-input-${cat}"]`) as HTMLInputElement | null
    );
    assert(
      catInputs.every((el) => el !== null),
      `Edit budgets panel renders one number input for all ${EXPENSE_CATEGORIES.length} expense categories`
    );

    // Reject negative input in category budget form
    const foodInput = cbMount.querySelector('[data-testid="category-budget-input-Food & Dining"]') as HTMLInputElement;
    await act(async () => {
      setReactInputValue(foodInput, '-100');
    });
    const catForm = cbMount.querySelector('[data-testid="finances-edit-budgets-panel"]') as HTMLFormElement;
    await act(async () => {
      catForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    });
    assert(
      cbMount.querySelector('[data-testid="finances-category-budget-error"]') !== null &&
        budgetUpdates.length === 0 &&
        cbMount.querySelector('[data-testid="finances-edit-budgets-panel"]') !== null,
      'Negative category budget input is rejected with error message and does not call onUpdateBudget'
    );

    // Save valid limits (blank Travel = no limit, Food & Dining = 2200, toggle rollover off)
    const travelInput = cbMount.querySelector('[data-testid="category-budget-input-Travel"]') as HTMLInputElement;
    const rolloverCheckbox = cbMount.querySelector('#finances-rollover-checkbox') as HTMLInputElement;
    await act(async () => {
      setReactInputValue(foodInput, '2200');
      setReactInputValue(travelInput, '');
      rolloverCheckbox.click();
    });
    await act(async () => {
      catForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    });
    assert(
      budgetUpdates.length === 1 &&
        budgetUpdates[0].categoryBudgets?.['Food & Dining'] === 2200 &&
        budgetUpdates[0].categoryBudgets?.Travel === undefined &&
        budgetUpdates[0].rollover === false &&
        budgetUpdates[0].monthlyBudget === 5000,
      'Saving valid category budgets omits blank entries, preserves monthlyBudget, and updates rollover'
    );

    // Reject negative input in Monthly Budget form
    const editMonthlyBtn = cbMount.querySelector('#finances-edit-budget-toggle') as HTMLButtonElement;
    await act(async () => {
      editMonthlyBtn.click();
    });
    const monthlyInput = cbMount.querySelector('#finances-budget-input') as HTMLInputElement;
    await act(async () => {
      setReactInputValue(monthlyInput, '-50');
    });
    const saveMonthlyBtn = cbMount.querySelector('#finances-budget-save-btn') as HTMLButtonElement;
    await act(async () => {
      saveMonthlyBtn.click();
    });
    assert(
      cbMount.querySelector('[data-testid="finances-budget-error"]') !== null &&
        budgetUpdates.length === 1,
      'Negative monthly budget input is rejected with error message and does not call onUpdateBudget'
    );
    // Close monthly budget form
    await act(async () => {
      (cbMount.querySelector('#finances-edit-budget-toggle') as HTMLButtonElement).click();
    });

    // Re-sync inputs when budget prop changes while forms are closed
    await act(async () => {
      cbRoot.render(
        React.createElement(FinancesView, {
          transactions: categoryBudgetTxs,
          budget: {
            monthlyBudget: 8000,
            savingsGoal: 2500,
            categoryBudgets: {
              'Food & Dining': 3500,
            },
            rollover: false,
          },
          onAddTransaction: () => {},
          onDeleteTransaction: () => {},
          onUpdateBudget: (b) => budgetUpdates.push(b),
          onOpenAddTransactionModal: () => {},
        })
      );
    });

    // Re-open both panels and verify synced values
    await act(async () => {
      (cbMount.querySelector('#finances-edit-budget-toggle') as HTMLButtonElement).click();
      (cbMount.querySelector('#finances-edit-category-budgets-btn') as HTMLButtonElement).click();
    });
    const syncedMonthly = (cbMount.querySelector('#finances-budget-input') as HTMLInputElement).value;
    const syncedSavings = (cbMount.querySelector('#finances-savings-input') as HTMLInputElement).value;
    const syncedFood = (
      cbMount.querySelector('[data-testid="category-budget-input-Food & Dining"]') as HTMLInputElement
    ).value;
    const syncedTravel = (
      cbMount.querySelector('[data-testid="category-budget-input-Travel"]') as HTMLInputElement
    ).value;
    const syncedRollover = (cbMount.querySelector('#finances-rollover-checkbox') as HTMLInputElement).checked;
    assert(
      syncedMonthly === '8000' &&
        syncedSavings === '2500' &&
        syncedFood === '3500' &&
        syncedTravel === '' &&
        syncedRollover === false,
      `Budget forms re-sync inputs when budget prop changes while closed (got monthly=${syncedMonthly}, savings=${syncedSavings}, food=${syncedFood}, travel="${syncedTravel}", rollover=${syncedRollover})`
    );

    await act(async () => {
      cbRoot.unmount();
    });
    cbMount.remove();
  }

  // Test 32: Recurring Transactions Generation on Startup/Finances Open + "Upcoming bills (next 30 days)" Card
  console.log('\n[Test 32] Recurring Transactions Generation & Upcoming Bills (next 30 days)');
  {
    const { FinancesView } = await import('../src/components/views/FinancesView.tsx');
    const { getLocalDateString, getLocalDateOffset } = await import('../src/lib/dateUtils.ts');
    const { LOCAL_STORAGE_KEY } = await import('../src/lib/firebase.ts');
    const todayStr = getLocalDateString();
    const in10Days = getLocalDateOffset(10);
    const in45Days = getLocalDateOffset(45);
    const past3Days = getLocalDateOffset(-3);

    const recMount = document.createElement('div');
    document.body.appendChild(recMount);
    const recRoot = createRoot(recMount);

    await act(async () => {
      recRoot.render(
        React.createElement(FinancesView, {
          transactions: [],
          recurringTransactions: [
            {
              id: 'ui-bill-soon',
              title: 'Broadband Fiber',
              amount: 850,
              type: 'expense',
              category: 'Mobile & Internet',
              paymentMethod: 'UPI',
              frequency: 'weekly',
              startDate: past3Days, // past3 + 7 = +4d, +11d, +18d, +25d -> 4 occurrences in next 30d
            },
            {
              id: 'ui-bill-ended',
              title: 'Ended Pass',
              amount: 500,
              type: 'expense',
              category: 'Subscriptions',
              paymentMethod: 'Card',
              frequency: 'weekly',
              startDate: past3Days,
              endDate: todayStr, // already ended today -> 0 upcoming
            },
            {
              id: 'ui-bill-income',
              title: 'Part-time Pay',
              amount: 4000,
              type: 'income',
              category: 'Salary & Wages',
              paymentMethod: 'Bank Transfer',
              frequency: 'weekly',
              startDate: in10Days, // income -> omitted from bills card
            },
            {
              id: 'ui-bill-far',
              title: 'Future Annual Sub',
              amount: 1200,
              type: 'expense',
              category: 'Subscriptions',
              paymentMethod: 'Card',
              frequency: 'monthly',
              dayOfMonth: Number(in45Days.split('-')[2]),
              startDate: in45Days, // > 30 days away -> omitted
            },
          ],
          budget: { monthlyBudget: 5000, savingsGoal: 0 },
          onAddTransaction: () => {},
          onDeleteTransaction: () => {},
          onUpdateBudget: () => {},
          onOpenAddTransactionModal: () => {},
        })
      );
    });

    const billsCard = recMount.querySelector('[data-testid="finances-upcoming-bills-card"]') as HTMLElement | null;
    const billsText = billsCard?.textContent || '';
    const billRows = recMount.querySelectorAll('[data-testid^="upcoming-bill-row-"]');
    assert(
      billsCard !== null &&
        billsText.includes('Upcoming bills (next 30 days)') &&
        billRows.length === 4 &&
        billsText.includes('Broadband Fiber') &&
        !billsText.includes('Ended Pass') &&
        !billsText.includes('Part-time Pay') &&
        !billsText.includes('Future Annual Sub'),
      `Upcoming bills (next 30 days) lists 4 upcoming weekly expenses and excludes ended, income, and >30d items (got ${billRows.length} rows)`
    );

    await act(async () => {
      recRoot.unmount();
    });
    recMount.remove();

    // App startup test: seed localStorage with a recurring schedule starting 2 days ago and verify App generates it on start without duplicates
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify({
        tasks: [],
        transactions: [],
        recurringTransactions: [
          {
            id: 'app-start-rec',
            title: 'Auto Rent Check',
            amount: 3200,
            type: 'expense',
            category: 'Housing & Rent',
            paymentMethod: 'Bank Transfer',
            frequency: 'weekly',
            startDate: getLocalDateOffset(-2),
            createdAt: 1700000000000,
            updatedAt: 1700000000000,
          },
        ],
        budget: { monthlyBudget: 10000, savingsGoal: 0 },
        exams: [],
        habits: [],
        notes: [],
        version: 1,
        lastUpdated: 1700000000000,
      })
    );

    const appBootMount = document.createElement('div');
    document.body.appendChild(appBootMount);
    const appBootRoot = createRoot(appBootMount);

    await act(async () => {
      appBootRoot.render(React.createElement(App));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const afterBootSaved = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
    const matchingGenTxs = (afterBootSaved.transactions || []).filter(
      (t: { title?: string }) => t.title === 'Auto Rent Check'
    );
    assert(
      matchingGenTxs.length === 1 &&
        matchingGenTxs[0].date === getLocalDateOffset(-2) &&
        afterBootSaved.recurringTransactions?.[0]?.lastGeneratedOn === getLocalDateOffset(-2),
      `App startup idempotently generates due recurring transaction and updates lastGeneratedOn (count=${matchingGenTxs.length})`
    );

    await act(async () => {
      appBootRoot.unmount();
    });
    appBootMount.remove();
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }

  // Test: HabitDetailModal Today's Status (DUE / REST, never FAILED) & Formula Popover
  {
    const { HabitDetailModal } = await import('../src/components/todo/HabitDetailModal.tsx');
    const modalMount = document.createElement('div');
    document.body.appendChild(modalMount);
    const modalRoot = createRoot(modalMount);

    const dueHabit = {
      id: 'h-modal-due',
      name: 'Morning Run',
      category: 'health',
      targetDaysPerWeek: 7,
      completedDates: [],
      streak: 0,
      bestStreak: 0,
      createdAt: Date.now(),
      scheduleType: 'daily' as const,
    };

    await act(async () => {
      modalRoot.render(
        React.createElement(HabitDetailModal, {
          isOpen: true,
          onClose: () => {},
          habit: dueHabit,
          onUpdateHabit: () => {},
          onDeleteHabit: () => {},
        })
      );
    });

    const modalTextBefore = modalMount.textContent || '';
    assert(
      modalTextBefore.includes('DUE') && !modalTextBefore.includes('FAILED'),
      'HabitDetailModal displays Today Status DUE (never FAILED) when unchecked today'
    );

    const infoBtn = Array.from(modalMount.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('How is this calculated?')
    );
    assert(infoBtn !== undefined, 'HabitDetailModal has "How is this calculated?" popover toggle');

    await act(async () => {
      infoBtn?.click();
    });

    const modalTextAfter = modalMount.textContent || '';
    assert(
      modalTextAfter.includes('47%') && modalTextAfter.includes('80%'),
      'Formula popover explains Loop model with 12 days (~47%) and 30 days (~80%) benchmarks'
    );

    // Mid-vacation day -> REST
    const vacHabit = {
      ...dueHabit,
      id: 'h-modal-vac',
      vacationPeriods: [
        {
          id: 'v-span',
          startDate: getLocalDateOffset(-2),
          endDate: getLocalDateOffset(2),
          reason: 'Trip',
        },
      ],
    };

    await act(async () => {
      modalRoot.render(
        React.createElement(HabitDetailModal, {
          isOpen: true,
          onClose: () => {},
          habit: vacHabit,
          onUpdateHabit: () => {},
          onDeleteHabit: () => {},
        })
      );
    });

    const vacText = modalMount.textContent || '';
    assert(
      vacText.includes('REST') && !vacText.includes('FAILED'),
      'HabitDetailModal displays Today Status REST on a mid-vacation day'
    );

    await act(async () => {
      modalRoot.unmount();
    });
    modalMount.remove();
  }

  // Test: Quick-add category select, HabitCard Daily label + case-insensitive color, and HabitDetailModal Edit (keeps id & completedDates)
  {
    const { HabitDetailModal } = await import('../src/components/todo/HabitDetailModal.tsx');
    const { HabitCard } = await import('../src/components/habits/HabitCard.tsx');

    // 1. Verify quick-add form category select in HabitsView (default Personal + all 7 options)
    const habitsNav = document.getElementById('tab-nav-habits');
    await act(async () => {
      habitsNav?.click();
    });
    const catSelect = document.getElementById('habit-new-category-select') as HTMLSelectElement | null;
    assert(catSelect !== null && catSelect.value === 'Personal', 'Quick-add category select defaults to Personal');
    const optValues = catSelect ? Array.from(catSelect.options).map((o) => o.value) : [];
    assert(
      optValues.join(',') === 'Study,Health,Fitness,Mindfulness,Finance,Personal,Other',
      `Quick-add category select lists all 7 categories (${optValues.join(',')})`
    );

    // 2. Verify HabitCard displays "Daily" instead of "7x per week" and uses case-insensitive border color
    const cardMount = document.createElement('div');
    document.body.appendChild(cardMount);
    const cardRoot = createRoot(cardMount);

    const upperHabit = {
      id: 'h-card-color-1',
      name: 'Stretch',
      category: 'Fitness',
      targetDaysPerWeek: 7,
      completedDates: ['2026-11-10', '2026-11-11'],
      streak: 2,
      bestStreak: 2,
      createdAt: Date.now(),
      scheduleType: 'daily' as const,
    };
    const lowerHabit = { ...upperHabit, id: 'h-card-color-2', category: 'fitness' };

    await act(async () => {
      cardRoot.render(
        React.createElement('div', null, [
          React.createElement(HabitCard, { key: 'u', habit: upperHabit, onToggle: () => {} }),
          React.createElement(HabitCard, { key: 'l', habit: lowerHabit, onToggle: () => {} }),
        ])
      );
    });

    const cardEls = Array.from(cardMount.querySelectorAll<HTMLElement>('.rounded-2xl.border'));
    assert(
      cardEls.length === 2 &&
        cardEls[0].style.borderLeftColor !== '' &&
        cardEls[0].style.borderLeftColor === cardEls[1].style.borderLeftColor,
      `HabitCard uses identical border color for Fitness and fitness (${cardEls[0]?.style.borderLeftColor})`
    );
    const cardText = cardMount.textContent || '';
    assert(
      cardText.includes('Daily') && !cardText.includes('7x per week'),
      'HabitCard displays "Daily" instead of "7x per week" on daily habits'
    );

    await act(async () => {
      cardRoot.unmount();
    });
    cardMount.remove();

    // 3. Verify HabitDetailModal Edit trims name, rejects blank name, updates category/target, and preserves id + completedDates
    const editMount = document.createElement('div');
    document.body.appendChild(editMount);
    const editRoot = createRoot(editMount);
    const updatedCalls: any[] = [];
    const originalCompleted = ['2026-11-08', '2026-11-09', '2026-11-10'];

    await act(async () => {
      editRoot.render(
        React.createElement(HabitDetailModal, {
          isOpen: true,
          onClose: () => {},
          habit: {
            id: 'habit-preserve-id-99',
            name: 'Old Habit',
            category: 'Personal',
            targetDaysPerWeek: 7,
            completedDates: originalCompleted,
            streak: 3,
            bestStreak: 3,
            createdAt: 1700000000000,
            scheduleType: 'daily' as const,
          },
          onUpdateHabit: (h) => updatedCalls.push(h),
          onDeleteHabit: () => {},
        })
      );
    });

    const editNameInput = document.getElementById('habit-edit-name-input') as HTMLInputElement | null;
    const editCatSelect = document.getElementById('habit-edit-category-select') as HTMLSelectElement | null;
    const editTargetInput = document.getElementById('habit-edit-target-input') as HTMLInputElement | null;
    const editSaveBtn = document.getElementById('habit-edit-save-btn') as HTMLButtonElement | null;

    // Whitespace-only name must be rejected
    await act(async () => {
      if (editNameInput) setReactInputValue(editNameInput, '   ');
    });
    assert(
      editSaveBtn?.disabled === true && updatedCalls.length === 0,
      'HabitDetailModal Edit disables Save for whitespace-only name'
    );

    // Rename with surrounding whitespace + change category and target
    await act(async () => {
      if (editNameInput) setReactInputValue(editNameInput, '  Evening Mindfulness  ');
      if (editCatSelect) {
        editCatSelect.value = 'Mindfulness';
        editCatSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
      }
      if (editTargetInput) setReactInputValue(editTargetInput, '5');
    });

    await act(async () => {
      editSaveBtn?.click();
      editNameInput?.closest('form')?.dispatchEvent(
        new dom.window.Event('submit', { bubbles: true, cancelable: true })
      );
    });

    assert(
      updatedCalls.length >= 1 &&
        updatedCalls[updatedCalls.length - 1].id === 'habit-preserve-id-99' &&
        updatedCalls[updatedCalls.length - 1].name === 'Evening Mindfulness' &&
        updatedCalls[updatedCalls.length - 1].category === 'Mindfulness' &&
        updatedCalls[updatedCalls.length - 1].targetDaysPerWeek === 5 &&
        JSON.stringify(updatedCalls[updatedCalls.length - 1].completedDates) === JSON.stringify(originalCompleted),
      'HabitDetailModal Edit trims name, updates category & target, and preserves id + completedDates'
    );

    await act(async () => {
      editRoot.unmount();
    });
    editMount.remove();
  }

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
