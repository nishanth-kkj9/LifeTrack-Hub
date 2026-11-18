import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { prepareRestore } from '../src/lib/dataExport.ts';
import type { UserAppData } from '../src/types/index.ts';

const dom = new JSDOM(
  '<!DOCTYPE html><html><head><title>Backup Restore Flow Test</title></head><body><div id="root"></div></body></html>',
  {
    url: 'http://localhost:3000',
    pretendToBeVisual: true,
  }
);

Object.defineProperty(globalThis, 'window', { value: dom.window, writable: true, configurable: true });
Object.defineProperty(globalThis, 'document', { value: dom.window.document, writable: true, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
Object.defineProperty(globalThis, 'HTMLElement', { value: dom.window.HTMLElement, writable: true, configurable: true });
Object.defineProperty(globalThis, 'File', { value: dom.window.File, writable: true, configurable: true });
Object.defineProperty(globalThis, 'Blob', { value: dom.window.Blob, writable: true, configurable: true });
Object.defineProperty(globalThis, 'FileReader', { value: dom.window.FileReader, writable: true, configurable: true });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function flushMicrotasks() {
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 15));
  }
}

function makeJsonFile(content: string, name = 'backup.json'): File {
  return new dom.window.File([content], name, { type: 'application/json' });
}

async function uploadFileToInput(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', {
    value: [file],
    configurable: true,
  });
  await act(async () => {
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await flushMicrotasks();
  });
}

async function runBackupRestoreTests() {
  console.log('--- Starting Shared Backup prepareRestore & Confirm Dialog Tests ---');

  // 1. prepareRestore unit checks
  // 1a. Rejects > 2 MB file
  const oversized = { size: 2 * 1024 * 1024 + 1 } as File;
  let sizeErr = '';
  try {
    await prepareRestore(oversized);
  } catch (err: any) {
    sizeErr = err?.message || '';
  }
  assert(
    sizeErr.toLowerCase().includes('2 mb'),
    `prepareRestore rejects files over 2 MB (got "${sizeErr}")`
  );

  // 1b. Rejects invalid JSON with friendly error
  let parseErr = '';
  try {
    await prepareRestore(makeJsonFile('{not valid json'));
  } catch (err: any) {
    parseErr = err?.message || '';
  }
  assert(
    parseErr === "That file isn't valid JSON",
    `prepareRestore rejects malformed JSON with friendly error (got "${parseErr}")`
  );

  // 1c. Rejects {} file with "This file has no LifeTrack data"
  let emptyErr = '';
  try {
    await prepareRestore(makeJsonFile('{}'));
  } catch (err: any) {
    emptyErr = err?.message || '';
  }
  assert(
    emptyErr === 'This file has no LifeTrack data',
    `prepareRestore rejects {} file with "This file has no LifeTrack data" (got "${emptyErr}")`
  );

  // 1d. Accepts dailyMetrics-only backup & returns counts
  const now = Date.now();
  const metricsOnly = await prepareRestore(
    makeJsonFile(
      JSON.stringify({
        dailyMetrics: [{ id: 'dm-1', date: '2026-11-18', moodLevel: 4, updatedAt: now }],
      })
    )
  );
  assert(
    metricsOnly.summary.dailyMetrics === 1 && metricsOnly.summary.tasks === 0,
    'prepareRestore accepts backup with dailyMetrics and returns counts summary'
  );

  // 2. UI Flow Tests for InsightsView and SettingsView
  const currentAppData: UserAppData = {
    tasks: [
      {
        id: 'cur-t1',
        title: 'Current Task',
        category: 'study',
        priority: 'medium',
        dueDate: '2026-11-18',
        completed: false,
        subtasks: [],
        createdAt: now,
      },
    ],
    transactions: [],
    budget: { monthlyBudget: 1000, savingsGoal: 500 },
    exams: [],
    habits: [],
    notes: [],
    dailyMetrics: [],
    version: 1,
    lastUpdated: now,
  };

  const incomingPayload = {
    tasks: [
      {
        id: 'bk-t1',
        title: 'Restored Task 1',
        category: 'work',
        priority: 'high',
        dueDate: '2026-11-19',
        completed: false,
        subtasks: [],
        createdAt: now,
      },
      {
        id: 'bk-t2',
        title: 'Restored Task 2',
        category: 'study',
        priority: 'low',
        dueDate: '2026-11-20',
        completed: true,
        completedAt: now,
        subtasks: [],
        createdAt: now,
      },
    ],
    habits: [
      {
        id: 'bk-h1',
        name: 'Reading',
        targetDaysPerWeek: 7,
        completedDates: ['2026-11-18'],
        streak: 1,
        bestStreak: 1,
        createdAt: now,
      },
    ],
    notes: [],
    transactions: [],
    exams: [],
    dailyMetrics: [],
  };

  // Mock URL.createObjectURL / revokeObjectURL & anchor click to track downloads cleanly in JSDOM
  const downloadedUrls: string[] = [];
  (dom.window.URL as any).createObjectURL = () => {
    const u = 'blob:mock-backup';
    downloadedUrls.push(u);
    return u;
  };
  (dom.window.URL as any).revokeObjectURL = () => {};
  (globalThis as any).URL = dom.window.URL;
  dom.window.HTMLAnchorElement.prototype.click = () => {};

  const { InsightsView } = await import('../src/components/views/InsightsView.tsx');
  const { SettingsView } = await import('../src/components/views/SettingsView.tsx');

  const container = document.getElementById('root')!;
  const root: Root = createRoot(container);

  for (const viewCase of ['InsightsView', 'SettingsView'] as const) {
    let restoreCalls: UserAppData[] = [];
    downloadedUrls.length = 0;

    await act(async () => {
      if (viewCase === 'InsightsView') {
        root.render(
          React.createElement(InsightsView, {
            tasks: currentAppData.tasks,
            habits: currentAppData.habits,
            transactions: currentAppData.transactions,
            budget: currentAppData.budget,
            exams: currentAppData.exams,
            dailyMetrics: currentAppData.dailyMetrics,
            appData: currentAppData,
            onRestoreAppData: (d: UserAppData) => {
              restoreCalls.push(d);
            },
          })
        );
      } else {
        root.render(
          React.createElement(SettingsView, {
            currentUser: null,
            isCloudSynced: false,
            appData: currentAppData,
            onLogin: () => {},
            onLogout: () => {},
            onRestoreData: (d: UserAppData) => {
              restoreCalls.push(d);
            },
            onResetData: () => {},
          })
        );
      }
    });

    const getFileInput = () =>
      container.querySelector('input[type="file"][accept=".json"]') as HTMLInputElement;

    // 2a. {} file -> role="status" error, no dialog, no restore call
    await uploadFileToInput(getFileInput(), makeJsonFile('{}'));
    const emptyStatus = container.querySelector('[role="status"]');
    assert(
      Boolean(emptyStatus && (emptyStatus.textContent || '').includes('This file has no LifeTrack data')) &&
        container.querySelector('[role="alertdialog"]') === null &&
        restoreCalls.length === 0,
      `${viewCase}: {} file shows "This file has no LifeTrack data" in role="status" and does not open dialog or apply`
    );

    // 2b. Invalid JSON -> friendly error in role="status"
    await uploadFileToInput(getFileInput(), makeJsonFile('{{{'));
    const jsonErrStatus = container.querySelector('[role="status"]');
    assert(
      Boolean(jsonErrStatus && (jsonErrStatus.textContent || '').includes("That file isn't valid JSON")) &&
        restoreCalls.length === 0,
      `${viewCase}: malformed JSON shows "That file isn't valid JSON" in role="status"`
    );

    // 2c. Valid file -> alertdialog opens, Cancel gets focus, Cancel changes nothing
    await uploadFileToInput(getFileInput(), makeJsonFile(JSON.stringify(incomingPayload)));
    const dialog = container.querySelector('[role="alertdialog"]');
    const dialogText = dialog?.textContent || '';
    const cancelBtn = Array.from(dialog?.querySelectorAll('button') || []).find(
      (b) => b.textContent?.trim() === 'Cancel'
    ) as HTMLButtonElement | undefined;
    const downloadFirstBtn = Array.from(dialog?.querySelectorAll('button') || []).find(
      (b) => b.textContent?.trim() === 'Download current backup first'
    ) as HTMLButtonElement | undefined;
    const replaceBtn = Array.from(dialog?.querySelectorAll('button') || []).find(
      (b) => b.textContent?.trim() === 'Replace'
    ) as HTMLButtonElement | undefined;

    assert(
      Boolean(dialog && cancelBtn && downloadFirstBtn && replaceBtn) &&
        dialogText.includes('Replace your current data with this backup?') &&
        dialogText.includes('2 tasks, 1 habit') &&
        dialogText.includes('You currently have 1 task, 0 habits') &&
        document.activeElement === cancelBtn,
      `${viewCase}: valid file opens role="alertdialog" with summary counts, 3 buttons, and focus on Cancel`
    );

    await act(async () => {
      cancelBtn?.click();
    });
    assert(
      container.querySelector('[role="alertdialog"]') === null && restoreCalls.length === 0,
      `${viewCase}: clicking Cancel closes dialog and changes nothing`
    );

    // 2d. Valid file -> Download current backup first works, then Replace applies
    await uploadFileToInput(getFileInput(), makeJsonFile(JSON.stringify(incomingPayload)));
    const dialog2 = container.querySelector('[role="alertdialog"]');
    const downloadFirstBtn2 = Array.from(dialog2?.querySelectorAll('button') || []).find(
      (b) => b.textContent?.trim() === 'Download current backup first'
    ) as HTMLButtonElement;
    const replaceBtn2 = Array.from(dialog2?.querySelectorAll('button') || []).find(
      (b) => b.textContent?.trim() === 'Replace'
    ) as HTMLButtonElement;

    await act(async () => {
      downloadFirstBtn2.click();
    });
    assert(
      downloadedUrls.length === 1 &&
        container.querySelector('[role="alertdialog"]') !== null &&
        restoreCalls.length === 0,
      `${viewCase}: "Download current backup first" triggers download without dismissing or replacing`
    );

    await act(async () => {
      replaceBtn2.click();
    });
    const successStatus = container.querySelector('[role="status"]');
    assert(
      container.querySelector('[role="alertdialog"]') === null &&
        restoreCalls.length === 1 &&
        restoreCalls[0].tasks.length === 2 &&
        restoreCalls[0].habits.length === 1 &&
        Boolean(successStatus && (successStatus.textContent || '').length > 0),
      `${viewCase}: clicking Replace applies sanitized data via existing handler and shows role="status" feedback`
    );
  }

  await act(async () => {
    root.unmount();
  });

  console.log('--- All Shared Backup prepareRestore & Confirm Dialog Tests Passed! ---');
}

await runBackupRestoreTests();
