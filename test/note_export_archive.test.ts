import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { sanitizeUserAppData, EMPTY_USER_DATA } from '../src/lib/firebase.ts';
import { formatNotesMarkdown, formatNotesJson } from '../src/lib/dataExport.ts';
import { QuickNote } from '../src/types/index.ts';

const dom = new JSDOM(
  '<!DOCTYPE html><html><head><title>LifeTrack Hub</title></head><body><div id="root"></div></body></html>',
  {
    url: 'http://localhost:3000',
    pretendToBeVisual: true,
  }
);

const capturedDownloads: Array<{ filename: string; type: string; text: string }> = [];

class CapturingBlob extends dom.window.Blob {
  private _textContent: string;
  constructor(parts: BlobPart[] = [], options?: BlobPropertyBag) {
    super(parts, options);
    this._textContent = parts
      .map((p) => (typeof p === 'string' ? p : String(p)))
      .join('');
  }
  get rawText(): string {
    return this._textContent;
  }
}

const blobByUrl = new Map<string, CapturingBlob>();
let urlCounter = 0;

Object.defineProperty(globalThis, 'window', { value: dom.window, writable: true, configurable: true });
Object.defineProperty(globalThis, 'document', { value: dom.window.document, writable: true, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: dom.window.localStorage, writable: true, configurable: true });
Object.defineProperty(globalThis, 'HTMLElement', { value: dom.window.HTMLElement, writable: true, configurable: true });
Object.defineProperty(globalThis, 'HTMLInputElement', { value: dom.window.HTMLInputElement, writable: true, configurable: true });
Object.defineProperty(globalThis, 'HTMLTextAreaElement', { value: dom.window.HTMLTextAreaElement, writable: true, configurable: true });
Object.defineProperty(globalThis, 'KeyboardEvent', { value: dom.window.KeyboardEvent, writable: true, configurable: true });
Object.defineProperty(globalThis, 'MouseEvent', { value: dom.window.MouseEvent, writable: true, configurable: true });
Object.defineProperty(globalThis, 'CustomEvent', { value: dom.window.CustomEvent, writable: true, configurable: true });
Object.defineProperty(globalThis, 'Blob', { value: CapturingBlob, writable: true, configurable: true });
Object.defineProperty(dom.window, 'Blob', { value: CapturingBlob, writable: true, configurable: true });

(dom.window.URL as any).createObjectURL = (blob: CapturingBlob) => {
  const url = `blob:test-${++urlCounter}`;
  blobByUrl.set(url, blob);
  return url;
};
(dom.window.URL as any).revokeObjectURL = (url: string) => {
  blobByUrl.delete(url);
};
Object.defineProperty(globalThis, 'URL', { value: dom.window.URL, writable: true, configurable: true });

// Intercept anchor clicks to capture filename + blob contents
const origClick = dom.window.HTMLAnchorElement.prototype.click;
dom.window.HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
  if (this.href && blobByUrl.has(this.href)) {
    const blob = blobByUrl.get(this.href)!;
    capturedDownloads.push({
      filename: this.download,
      type: blob.type,
      text: blob.rawText,
    });
    return;
  }
  return origClick.call(this);
};

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

function setReactInputValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(el, value);
  const reactPropsKey = Object.keys(el).find((k) => k.startsWith('__reactProps$'));
  const reactProps = reactPropsKey ? (el as any)[reactPropsKey] : null;
  if (reactProps && typeof reactProps.onChange === 'function') {
    reactProps.onChange({ target: el, currentTarget: el });
  } else {
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  }
}

async function runNoteExportArchiveTests() {
  console.log('--- Starting Note Export (MD/JSON) & Archive Tests ---');
  const now = Date.now();

  // 1. Sanitizer tests for archived?: boolean
  const { data: cleanSanitized, repaired: cleanRepaired } = sanitizeUserAppData({
    ...EMPTY_USER_DATA,
    notes: [
      { id: 'n1', title: 'One', content: 'Body', category: 'General', pinned: false, updatedAt: now, archived: true },
      { id: 'n2', title: 'Two', content: 'Body', category: 'General', pinned: false, updatedAt: now, archived: false },
    ],
  });
  assert(
    !cleanRepaired &&
      cleanSanitized.notes[0].archived === true &&
      cleanSanitized.notes[1].archived === false,
    'sanitizeUserAppData keeps boolean archived cleanly without marking repaired'
  );

  const { data: badSanitized, repaired: badRepaired } = sanitizeUserAppData({
    ...EMPTY_USER_DATA,
    notes: [
      { id: 'n3', title: 'Bad1', content: 'Body', category: 'General', pinned: false, updatedAt: now, archived: 'yes' },
      { id: 'n4', title: 'Bad2', content: 'Body', category: 'General', pinned: false, updatedAt: now, archived: 1 },
      { id: 'n5', title: 'Bad3', content: 'Body', category: 'General', pinned: false, updatedAt: now, archived: null },
    ],
  });
  assert(
    badRepaired &&
      badSanitized.notes.every((n) => !('archived' in n)),
    'sanitizeUserAppData deletes non-boolean archived values and flags repaired'
  );

  // 2. Pure export formatting tests
  const sampleNotes: QuickNote[] = [
    {
      id: 'note-active-1',
      title: 'Calculus <Notes> & "Formulas"',
      content: 'Use **chain rule** & <b>d/dx</b> `x^2 = 2*x` #math',
      category: 'Formulas',
      pinned: true,
      createdAt: now - 5000,
      contentUpdatedAt: now - 1000,
      updatedAt: now - 1000,
    },
    {
      id: 'note-archived-1',
      title: 'Old Semester Syllabus',
      content: 'Archived content stays in export #archive',
      category: 'Study',
      pinned: false,
      archived: true,
      updatedAt: now - 2000,
    },
    {
      id: 'note-tombstoned-1',
      title: 'Deleted Secret Note',
      content: 'Must NEVER appear in export',
      category: 'General',
      pinned: false,
      updatedAt: now - 3000,
      deletedAt: now - 500,
    },
  ];

  const md = formatNotesMarkdown(sampleNotes);
  assert(
    md.includes('## Calculus <Notes> & "Formulas"') &&
      md.includes('Category: Formulas | Pinned: Yes') &&
      md.includes('Tags: #math') &&
      md.includes('Use **chain rule** & <b>d/dx</b> `x^2 = 2*x` #math') &&
      md.includes('## Old Semester Syllabus') &&
      md.includes('Archived: Yes') &&
      !md.includes('Deleted Secret Note') &&
      !md.includes('Must NEVER appear in export') &&
      !md.includes('&lt;') &&
      !md.includes('&amp;') &&
      !md.includes('&quot;'),
    'formatNotesMarkdown includes all active notes (incl. archived), omits tombstones, and avoids destructive escaping'
  );

  const jsonParsed = JSON.parse(formatNotesJson(sampleNotes)) as QuickNote[];
  assert(
    jsonParsed.length === 2 &&
      jsonParsed.some((n) => n.id === 'note-active-1') &&
      jsonParsed.some((n) => n.id === 'note-archived-1') &&
      !jsonParsed.some((n) => n.id === 'note-tombstoned-1') &&
      jsonParsed[0].content === 'Use **chain rule** & <b>d/dx</b> `x^2 = 2*x` #math',
    'formatNotesJson includes every active note, excludes tombstoned notes, and preserves content verbatim'
  );

  // 3. UI Integration: NotesView (Export menu + Archived tab + Archive/Unarchive), NoteDetailModal, CommandPalette, SettingsView
  const { default: App } = await import('../src/App.tsx');
  dom.window.localStorage.clear();
  dom.window.localStorage.setItem(
    'lifetrack_app_data_v1',
    JSON.stringify({
      tasks: [],
      transactions: [],
      exams: [],
      habits: [],
      notes: sampleNotes,
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

  // In "All Notes", active note is visible, archived & tombstoned notes are hidden
  assert(
    document.getElementById('notes-tab-all')?.textContent?.trim() === 'All Notes (1)' &&
      document.getElementById('notes-tab-archived')?.textContent?.trim() === 'Archived (1)' &&
      document.getElementById('note-card-note-active-1') !== null &&
      document.getElementById('note-card-note-archived-1') === null &&
      document.getElementById('note-card-note-tombstoned-1') === null,
    'All Notes shows only non-archived active notes and displays Archived (1) tab'
  );

  // Switch to Archived tab -> archived note visible, active note hidden
  await act(async () => {
    document.getElementById('notes-tab-archived')?.click();
  });
  assert(
    document.getElementById('note-card-note-archived-1') !== null &&
      document.getElementById('note-card-note-active-1') === null,
    'Archived tab shows archived note and excludes non-archived note'
  );

  // Unarchive via NoteDetailModal
  await act(async () => {
    document.getElementById('note-open-title-note-archived-1')?.click();
  });
  assert(
    document.getElementById('note-detail-archived-badge') !== null &&
      document.getElementById('note-detail-archive-btn')?.textContent?.includes('Unarchive'),
    'NoteDetailModal shows Archived badge and Unarchive button'
  );
  await act(async () => {
    document.getElementById('note-detail-archive-btn')?.click();
  });
  await act(async () => {
    document.getElementById('close-note-detail-modal-btn')?.click();
  });
  assert(
    document.getElementById('notes-tab-archived')?.textContent?.trim() === 'Archived (0)' &&
      document.getElementById('notes-tab-all')?.textContent?.trim() === 'All Notes (2)',
    'Unarchiving in NoteDetailModal moves note back to All Notes'
  );

  // Switch back to All Notes and archive via card button
  await act(async () => {
    document.getElementById('notes-tab-all')?.click();
  });
  await act(async () => {
    document.getElementById('note-archive-note-archived-1')?.click();
  });
  assert(
    document.getElementById('notes-tab-all')?.textContent?.trim() === 'All Notes (1)' &&
      document.getElementById('notes-tab-archived')?.textContent?.trim() === 'Archived (1)' &&
      document.getElementById('note-card-note-archived-1') === null,
    'Card Archive button hides note from All Notes and moves it to Archived tab'
  );

  // Notes Header Export (Markdown + JSON)
  capturedDownloads.length = 0;
  await act(async () => {
    document.getElementById('notes-export-btn')?.click();
  });
  await act(async () => {
    document.getElementById('notes-export-md-btn')?.click();
  });
  await act(async () => {
    document.getElementById('notes-export-btn')?.click();
  });
  await act(async () => {
    document.getElementById('notes-export-json-btn')?.click();
  });
  assert(
    capturedDownloads.length === 2 &&
      capturedDownloads[0].filename.endsWith('.md') &&
      capturedDownloads[0].text.includes('## Calculus <Notes> & "Formulas"') &&
      capturedDownloads[0].text.includes('## Old Semester Syllabus') &&
      !capturedDownloads[0].text.includes('Deleted Secret Note') &&
      capturedDownloads[1].filename.endsWith('.json') &&
      JSON.parse(capturedDownloads[1].text).length === 2,
    'Notes header Export triggers Markdown and JSON downloads with active notes only'
  );

  // Command Palette hides archived notes but shows active notes
  await act(async () => {
    window.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
    );
  });
  const cmdInput = document.querySelector('input[aria-label="Command search query"]') as HTMLInputElement;
  assert(cmdInput !== null, 'Command Palette opens on Ctrl+K');

  await act(async () => {
    setReactInputValue(cmdInput, 'Old Semester Syllabus');
  });
  assert(
    document.getElementById('cmd-item-note-note-archived-1') === null,
    'Command Palette excludes archived note from search results'
  );

  await act(async () => {
    setReactInputValue(cmdInput, 'Calculus');
  });
  assert(
    document.getElementById('cmd-item-note-note-active-1') !== null,
    'Command Palette still finds non-archived active note'
  );

  await act(async () => {
    window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });

  // Settings Export notes (Markdown & JSON) excludes tombstoned notes too
  capturedDownloads.length = 0;
  await act(async () => {
    document.getElementById('tab-nav-settings')?.click();
  });
  await act(async () => {
    document.getElementById('settings-export-notes-md-btn')?.click();
    document.getElementById('settings-export-notes-json-btn')?.click();
  });
  assert(
    capturedDownloads.length === 2 &&
      capturedDownloads[0].filename.endsWith('.md') &&
      capturedDownloads[0].text.includes('## Calculus <Notes> & "Formulas"') &&
      !capturedDownloads[0].text.includes('Deleted Secret Note') &&
      capturedDownloads[1].filename.endsWith('.json') &&
      !capturedDownloads[1].text.includes('Deleted Secret Note'),
    'Settings Export notes (Markdown & JSON) includes active notes and excludes tombstones'
  );

  await act(async () => {
    root.unmount();
  });

  console.log('--- All Note Export (MD/JSON) & Archive Tests Passed! ---');
}

await runNoteExportArchiveTests();
