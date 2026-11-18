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
Object.defineProperty(globalThis, 'HTMLTextAreaElement', { value: dom.window.HTMLTextAreaElement, writable: true, configurable: true });
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

function setReactControlValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto =
    el instanceof dom.window.HTMLTextAreaElement
      ? dom.window.HTMLTextAreaElement.prototype
      : dom.window.HTMLInputElement.prototype;
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

async function runNoteDetailModalTests() {
  console.log('--- Starting NoteDetailModal & Card Clamp Tests ---');

  const { default: App } = await import('../src/App.tsx');

  const lines14 = Array.from({ length: 14 }, (_, i) => `Line ${i + 1}  indented`).join('\n');
  const lines3 = 'Short 1\nShort 2\nShort 3';
  const now = Date.now();

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
          id: 'note-14',
          title: 'Fourteen Line Note',
          content: lines14,
          category: 'Formulas',
          pinned: false,
          createdAt: now - 3600_000,
          contentUpdatedAt: now - 1800_000,
          updatedAt: now - 1800_000,
        },
        {
          id: 'note-3',
          title: 'Short Three Line Note',
          content: lines3,
          category: 'Study',
          pinned: false,
          createdAt: now - 7200_000,
          contentUpdatedAt: now - 7200_000,
          updatedAt: now - 7200_000,
        },
      ],
      dailyMetrics: [],
      budget: { monthlyBudget: 0, savingsGoal: 0 },
      version: 1,
      lastUpdated: now,
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

  // 1. "Show more" renders only on >6 line note
  assert(
    document.getElementById('note-show-more-note-14') !== null &&
      document.getElementById('note-show-more-note-3') === null,
    '"Show more" renders on 14-line note and is omitted on 3-line note'
  );

  // Preview element has line-clamp-6, exact 6-line max-h-[7.5rem], and overflow-hidden
  const previewEl = document.getElementById('note-preview-note-14');
  assert(
    previewEl !== null &&
      previewEl.className.includes('line-clamp-6') &&
      previewEl.className.includes('max-h-[7.5rem]') &&
      previewEl.className.includes('overflow-hidden'),
    'Card preview uses line-clamp-6, max-h-[7.5rem], and overflow-hidden'
  );

  // 2. Clicking card title opens NoteDetailModal and shows "Line 14" with whitespace preserved
  await act(async () => {
    document.getElementById('note-open-title-note-14')?.click();
  });

  const dialog = document.querySelector('#note-detail-modal-backdrop[role="dialog"]');
  const detailContent = document.getElementById('note-detail-content');
  assert(
    dialog !== null &&
      document.getElementById('note-detail-modal-title')?.textContent === 'Fourteen Line Note' &&
      (detailContent?.textContent || '').includes('Line 14  indented') &&
      detailContent?.className.includes('whitespace-pre-wrap'),
    'Clicking note card title opens NoteDetailModal displaying "Line 14" and whitespace-preserved content'
  );

  // Metadata + action buttons visible
  assert(
    document.getElementById('note-detail-edited-time') !== null &&
      document.getElementById('note-detail-created-time') !== null &&
      document.getElementById('note-detail-pin-btn') !== null &&
      document.getElementById('note-detail-edit-btn') !== null &&
      document.getElementById('note-detail-copy-btn') !== null &&
      document.getElementById('note-detail-delete-btn') !== null,
    'NoteDetailModal displays times, pin, edit, copy, and delete controls'
  );

  // 3. Pressing Escape closes NoteDetailModal
  await act(async () => {
    document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  assert(
    document.querySelector('#note-detail-modal-backdrop[role="dialog"]') === null,
    'Pressing Escape closes NoteDetailModal'
  );

  // 4. Clicking Open icon button opens NoteDetailModal and in-modal Edit saves changes
  await act(async () => {
    document.getElementById('note-open-note-3')?.click();
  });
  assert(
    document.getElementById('note-detail-modal-title')?.textContent === 'Short Three Line Note',
    'Clicking "Open" icon button opens NoteDetailModal for short note'
  );

  await act(async () => {
    document.getElementById('note-detail-edit-btn')?.click();
  });
  const modalTextarea = document.getElementById('note-detail-edit-content') as HTMLTextAreaElement | null;
  await act(async () => {
    if (modalTextarea) setReactControlValue(modalTextarea, 'Updated short line 1\nUpdated short line 2');
  });
  await act(async () => {
    document.querySelector('#note-detail-modal-card form')?.dispatchEvent(
      new dom.window.Event('submit', { bubbles: true, cancelable: true })
    );
  });
  assert(
    (document.getElementById('note-detail-content')?.textContent || '').includes('Updated short line 2'),
    'In-modal Edit updates note content cleanly'
  );

  // 5. In-card quick edit still works alongside NoteDetailModal
  await act(async () => {
    document.getElementById('close-note-detail-modal-btn')?.click();
  });
  await act(async () => {
    document.getElementById('note-edit-note-3')?.click();
  });
  assert(
    document.querySelector('#note-card-note-3 textarea') !== null,
    'In-card quick edit remains intact'
  );
  await act(async () => {
    Array.from(document.querySelectorAll('#note-card-note-3 button'))
      .find((b) => b.textContent?.trim() === 'Cancel')
      ?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  });

  // 6. Delete inside NoteDetailModal closes modal and triggers 6s undo toast
  await act(async () => {
    document.getElementById('note-show-more-note-14')?.click();
  });
  assert(
    document.querySelector('#note-detail-modal-backdrop[role="dialog"]') !== null,
    'Clicking "Show more" opens NoteDetailModal'
  );
  await act(async () => {
    document.getElementById('note-detail-delete-btn')?.click();
  });
  assert(
    document.querySelector('#note-detail-modal-backdrop[role="dialog"]') === null &&
      document.getElementById('note-card-note-14') === null &&
      document.getElementById('note-undo-toast-banner') !== null,
    'Deleting inside NoteDetailModal closes modal, removes card, and shows undo toast'
  );

  await act(async () => {
    document.getElementById('note-undo-toast-btn')?.click();
  });
  assert(
    document.getElementById('note-card-note-14') !== null,
    'Undo after NoteDetailModal delete restores the note card'
  );

  await act(async () => {
    root.unmount();
  });

  console.log('--- All NoteDetailModal & Card Clamp Tests Passed! ---');
}

await runNoteDetailModalTests();
