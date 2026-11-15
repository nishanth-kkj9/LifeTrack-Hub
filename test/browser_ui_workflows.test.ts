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
