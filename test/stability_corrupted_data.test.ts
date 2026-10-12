/**
 * STABILITY REGRESSION SUITE: corrupted persisted data must never white-screen the app.
 *
 * Background (empirically reproduced before the fix):
 *   localStorage { "tasks": [null], ... } → TypeError: Cannot read properties of null
 *   → React unmounted the whole tree → root.innerHTML.length === 0 (permanent white screen,
 *   no recovery UI, corrupted data persisted forever).
 *
 * Now asserted:
 *   1. App renders fully despite corrupted entries (sanitizer strips them).
 *   2. The original corrupted payload is quarantined (never silently deleted).
 *   3. ErrorBoundary shows a recovery UI when a render crash does occur.
 */
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div><div id="root2"></div></body></html>', {
  url: 'http://localhost:3000',
  pretendToBeVisual: true,
});
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
(globalThis.window as any).matchMedia = () => ({
  matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {},
});
(globalThis.window as any).AudioContext = class {
  createOscillator() { return { type: '', frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
  createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} }; }
  createBufferSource() { return { buffer: null, loop: false, connect() {}, start() {}, stop() {}, playbackRate: { setValueAtTime() {}, value: 1 }, onended: null }; }
  get destination() { return {}; }
  get currentTime() { return 0; }
  resume() {}
  close() {}
};

let passed = 0;
let total = 0;
function check(name: string, condition: boolean) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    console.error(`  ✗ FAIL: ${name}`);
    process.exitCode = 1;
    throw new Error(`Stability test failed: ${name}`);
  }
}

// Silence expected React error logging from the deliberate ErrorBoundary crash test
const origConsoleError = console.error;
console.error = (...args: any[]) => {
  const m = String(args[0] ?? '');
  if (m.includes('The above error occurred') || m.includes('ErrorBoundary] Render crashed') || m.includes('Boom')) return;
  origConsoleError(...args);
};

const CORRUPT_PAYLOAD = JSON.stringify({
  tasks: [null, { id: 'ok-1', title: 'Valid task', category: 'study', priority: 'high', dueDate: '2026-01-01', completed: false, subtasks: null, createdAt: 1 }],
  transactions: 'not-an-array',
  budget: { monthlyBudget: 'NaN-string', savingsGoal: 0 },
  exams: [null],
  habits: [{ id: 'h1', name: 'x', targetDaysPerWeek: 7, completedDates: null, streak: 0, bestStreak: 0, createdAt: 1 }],
  notes: [],
});

async function main() {
  console.log('--- Starting Corrupted-Data Stability Suite ---');
  dom.window.localStorage.setItem('lifetrack_app_data_v1', CORRUPT_PAYLOAD);

  const { default: App } = await import('../src/App.tsx');
  const { ErrorBoundary } = await import('../src/components/common/ErrorBoundary.tsx');

  // 1. Full app renders despite corrupted persisted state
  const container = dom.window.document.getElementById('root')!;
  const root = createRoot(container as any);
  let renderError: unknown = null;
  try {
    await act(async () => { root.render(React.createElement(App)); });
  } catch (e) {
    renderError = e;
  }
  check('Corrupted localStorage does not crash initial render', renderError === null);
  check('App renders substantial UI despite corrupted data', container.innerHTML.length > 1000);

  // 2. Original corrupted payload quarantined for recovery
  const backup = dom.window.localStorage.getItem('lifetrack_app_data_v1_corrupt_backup');
  check('Corrupted payload quarantined to backup key (not silently deleted)', backup === CORRUPT_PAYLOAD);

  // 3. ErrorBoundary fallback works for genuine render crashes
  const Boom = () => { throw new Error('Boom: simulated render crash'); };
  const c2 = dom.window.document.getElementById('root2')!;
  const root2 = createRoot(c2 as any);
  await act(async () => {
    root2.render(React.createElement(ErrorBoundary, null, React.createElement(Boom)));
  });
  check('ErrorBoundary renders recovery UI on crash', c2.innerHTML.includes('unexpected error'));
  check('ErrorBoundary offers data-reset recovery action', c2.innerHTML.includes('Reset local data'));

  console.log(`--- ${passed}/${total} Corrupted-Data Stability Checks Passed ---`);
  process.exit(process.exitCode ?? 0);
}

main().catch((e) => {
  origConsoleError(e);
  process.exit(1);
});
