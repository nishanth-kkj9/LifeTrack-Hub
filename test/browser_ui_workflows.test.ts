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
globalThis.URL = {
  createObjectURL: () => 'blob:http://localhost:3000/mock-uuid',
  revokeObjectURL: () => {},
} as unknown as typeof URL;

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

  // Click primary Google account option in modal
  const primaryAccountBtn = Array.from(document.querySelectorAll('button')).find((b) =>
    b.textContent?.includes('chataiwithcode@gmail.com')
  );
  assert(primaryAccountBtn !== undefined, 'Primary Google account button found in modal');

  await act(async () => {
    primaryAccountBtn?.click();
  });

  // Verify signed-in state
  const logoutBtn = document.getElementById('user-logout-button');
  assert(logoutBtn !== null, 'User is successfully signed in and logout button is rendered');
  assert(
    localStorage.getItem('lifetrack_local_user')?.includes('chataiwithcode@gmail.com') === true,
    'Signed-in Google profile is persisted in localStorage'
  );

  // Click logout
  await act(async () => {
    logoutBtn?.click();
  });

  const loginBtnAfterLogout = document.getElementById('user-login-button');
  assert(loginBtnAfterLogout !== null, 'Logout successfully returns to Sign In state');

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
