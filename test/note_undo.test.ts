import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import type { QuickNote } from '../src/types/index.ts';

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

async function runNoteUndoTests() {
  console.log('--- Starting Note Delete Undo Toast Tests ---');

  const { restoreEntity, restoreTransaction, tombstone, isActive } = await import('../src/lib/entity.ts');
  const { default: App } = await import('../src/App.tsx');

  // 1. Generic restoreEntity & restoreTransaction alias check
  {
    const baseNote: QuickNote = {
      id: 'n-unit',
      title: 'Fourier Series',
      content: 'a0 + sum(...)',
      category: 'Formulas',
      pinned: true,
      updatedAt: 1000,
    };
    const deleted = tombstone(baseNote, 2000);
    assert(deleted.deletedAt === 2000 && !isActive(deleted), 'tombstone sets deletedAt on note');

    const restored = restoreEntity(deleted, 2000);
    assert(
      !('deletedAt' in restored) &&
        isActive(restored) &&
        restored.updatedAt === 2001 &&
        restored.title === baseNote.title &&
        restored.content === baseNote.content,
      'restoreEntity clears deletedAt, preserves note fields, and bumps updatedAt strictly past tombstone'
    );
    assert(
      restoreTransaction === restoreEntity,
      'restoreTransaction remains an alias for restoreEntity'
    );
  }

  // 2. UI integration: delete -> 6s toast -> Undo restores note with newer updatedAt
  const initialUpdatedAt = 1700000000000;
  dom.window.localStorage.clear();
  dom.window.localStorage.setItem(
    'lifetrack_app_data_v1',
    JSON.stringify({
      tasks: [],
      transactions: [],
      exams: [],
      habits: [],
      notes: [
        {
          id: 'note-undo-1',
          title: 'First Note',
          content: 'First note body',
          category: 'Study',
          pinned: false,
          updatedAt: initialUpdatedAt,
        },
        {
          id: 'note-undo-2',
          title: 'Second Note',
          content: 'Second note body',
          category: 'Ideas',
          pinned: true,
          updatedAt: initialUpdatedAt,
        },
      ],
      dailyMetrics: [],
      budget: { monthlyBudget: 0, savingsGoal: 0 },
      version: 1,
      lastUpdated: initialUpdatedAt,
    })
  );

  const container = document.getElementById('root')!;
  const root: Root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(App));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 40));
  });

  await act(async () => {
    document.getElementById('tab-nav-notes')?.click();
  });

  assert(
    document.getElementById('note-card-note-undo-1') !== null &&
      document.getElementById('note-card-note-undo-2') !== null,
    'Seeded notes render in NotesView'
  );

  // Delete note 1
  await act(async () => {
    document.getElementById('note-delete-note-undo-1')?.click();
  });

  assert(
    document.getElementById('note-card-note-undo-1') === null,
    'Deleted note disappears immediately from NotesView'
  );

  const toastEl = document.getElementById('note-undo-toast-banner');
  const undoBtn = document.getElementById('note-undo-toast-btn') as HTMLButtonElement | null;
  assert(
    toastEl !== null &&
      (toastEl.textContent || '').includes('Note deleted -') &&
      toastEl.getAttribute('data-note-id') === 'note-undo-1' &&
      undoBtn !== null &&
      undoBtn.textContent?.trim() === 'Undo',
    'Note delete displays "Note deleted - Undo" toast for deleted note'
  );

  const whileDeletedRaw = JSON.parse(localStorage.getItem('lifetrack_app_data_v1') || '{"notes":[]}');
  const tombstonedNote1 = whileDeletedRaw.notes.find((n: QuickNote) => n.id === 'note-undo-1');
  assert(
    tombstonedNote1 !== undefined &&
      typeof tombstonedNote1.deletedAt === 'number' &&
      tombstonedNote1.deletedAt > 0,
    'Deleted note keeps tombstone with deletedAt in localStorage'
  );

  // Click Undo
  await act(async () => {
    undoBtn?.click();
  });

  assert(
    document.getElementById('note-undo-toast-banner') === null &&
      document.getElementById('note-card-note-undo-1') !== null,
    'Clicking Undo dismisses toast and restores note card in UI'
  );

  const afterUndoRaw = JSON.parse(localStorage.getItem('lifetrack_app_data_v1') || '{"notes":[]}');
  const restoredNote1 = afterUndoRaw.notes.find((n: QuickNote) => n.id === 'note-undo-1');
  assert(
    restoredNote1 !== undefined &&
      !('deletedAt' in restoredNote1) &&
      restoredNote1.updatedAt > initialUpdatedAt &&
      restoredNote1.updatedAt > (tombstonedNote1.deletedAt ?? 0),
    'Undo clears deletedAt and bumps updatedAt strictly newer than initial and tombstone timestamps'
  );

  // 3. Toast disappears after 6 s & deleting twice switches toast to the latest deleted note
  const origSetTimeout = globalThis.setTimeout;
  const origClearTimeout = globalThis.clearTimeout;
  const scheduledTimers = new Map<number, () => void>();
  const clearedIds: number[] = [];
  let nextTimerId = 90000;

  (globalThis as any).setTimeout = (fn: any, ms?: number, ...rest: any[]) => {
    if (ms === 6000) {
      const id = nextTimerId++;
      scheduledTimers.set(id, () => fn(...rest));
      return id as any;
    }
    return origSetTimeout(fn, ms, ...rest);
  };
  (globalThis as any).clearTimeout = (id: any) => {
    if (typeof id === 'number' && scheduledTimers.has(id)) {
      clearedIds.push(id);
      scheduledTimers.delete(id);
      return;
    }
    return origClearTimeout(id);
  };

  try {
    // Delete note 1 -> timer 90000
    await act(async () => {
      document.getElementById('note-delete-note-undo-1')?.click();
    });
    const firstToast = document.getElementById('note-undo-toast-banner');
    assert(
      firstToast?.getAttribute('data-note-id') === 'note-undo-1' && scheduledTimers.has(90000),
      'First delete shows toast for note-undo-1 and schedules 6000ms timer'
    );

    // Delete note 2 while toast is showing -> clears timer 90000 and switches toast to note-undo-2
    await act(async () => {
      document.getElementById('note-delete-note-undo-2')?.click();
    });
    const secondToast = document.getElementById('note-undo-toast-banner');
    assert(
      clearedIds.includes(90000) &&
        secondToast?.getAttribute('data-note-id') === 'note-undo-2' &&
        scheduledTimers.has(90001),
      'Second delete cancels first timer and switches toast to newest note (note-undo-2)'
    );

    // Clicking Undo now restores note-undo-2 and keeps note-undo-1 deleted
    await act(async () => {
      document.getElementById('note-undo-toast-btn')?.click();
    });
    assert(
      document.getElementById('note-undo-toast-banner') === null &&
        document.getElementById('note-card-note-undo-2') !== null &&
        document.getElementById('note-card-note-undo-1') === null,
      'Undo after two deletes restores only the latest deleted note (note-undo-2)'
    );

    // Delete note 2 again and let 6s timer fire -> toast disappears automatically
    await act(async () => {
      document.getElementById('note-delete-note-undo-2')?.click();
    });
    assert(
      document.getElementById('note-undo-toast-banner') !== null && scheduledTimers.has(90002),
      'Re-deleting note shows toast with 6s timer'
    );
    await act(async () => {
      scheduledTimers.get(90002)?.();
    });
    assert(
      document.getElementById('note-undo-toast-banner') === null,
      'Note undo toast disappears automatically after 6s timeout fires'
    );
  } finally {
    globalThis.setTimeout = origSetTimeout;
    globalThis.clearTimeout = origClearTimeout;
  }

  await act(async () => {
    root.unmount();
  });

  console.log('--- All Note Delete Undo Toast Tests Passed! ---');
}

await runNoteUndoTests();
