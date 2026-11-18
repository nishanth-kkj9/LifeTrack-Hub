import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import {
  parseNoteContent,
  toggleChecklistLine,
  getChecklistStats,
  isSafeHttpUrl,
} from '../src/lib/noteFormat.ts';

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

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function runNoteFormatTests() {
  console.log('--- Starting Note Format Parser & Checklist Tests ---');

  // 1. Parser table tests
  const parserCases = [
    {
      name: 'nested spaces checklist',
      input: '  - [ ] Nested task\n    - [x] Deep done',
      check: (blocks: ReturnType<typeof parseNoteContent>) =>
        blocks.length === 2 &&
        blocks[0].type === 'checklist' &&
        blocks[0].checked === false &&
        blocks[0].indent === '  ' &&
        blocks[1].type === 'checklist' &&
        blocks[1].checked === true &&
        blocks[1].indent === '    ',
    },
    {
      name: 'uppercase "[X]" treated as checked',
      input: '- [X] Uppercase done',
      check: (blocks: ReturnType<typeof parseNoteContent>) =>
        blocks.length === 1 &&
        blocks[0].type === 'checklist' &&
        blocks[0].checked === true &&
        deepEqual(blocks[0].tokens, [{ type: 'text', text: 'Uppercase done' }]),
    },
    {
      name: 'javascript: URL ignored as plain text',
      input: 'Try javascript:alert(1) and data:text/html,<b>hi</b>',
      check: (blocks: ReturnType<typeof parseNoteContent>) =>
        blocks.length === 1 &&
        blocks[0].type === 'line' &&
        blocks[0].tokens.every((t) => t.type === 'text') &&
        blocks[0].tokens[0].type === 'text' &&
        blocks[0].tokens[0].text === 'Try javascript:alert(1) and data:text/html,<b>hi</b>',
    },
    {
      name: 'HTML tags "<b>x</b>" stay plain text',
      input: 'Literal <b>x</b> stays text',
      check: (blocks: ReturnType<typeof parseNoteContent>) =>
        blocks.length === 1 &&
        deepEqual(blocks[0].tokens, [{ type: 'text', text: 'Literal <b>x</b> stays text' }]),
    },
    {
      name: 'bare http/https URLs and inline **bold**, *italic*, `code`',
      input: 'See https://example.com/docs?q=1, **bold** and *italic* plus `x = 2 * 3`.',
      check: (blocks: ReturnType<typeof parseNoteContent>) =>
        blocks.length === 1 &&
        deepEqual(blocks[0].tokens, [
          { type: 'text', text: 'See ' },
          { type: 'link', url: 'https://example.com/docs?q=1', label: 'https://example.com/docs?q=1' },
          { type: 'text', text: ', ' },
          { type: 'bold', text: 'bold' },
          { type: 'text', text: ' and ' },
          { type: 'italic', text: 'italic' },
          { type: 'text', text: ' plus ' },
          { type: 'code', text: 'x = 2 * 3' },
          { type: 'text', text: '.' },
        ]),
    },
    {
      name: 'math multiplication spacing stays plain text',
      input: 'Area = 2 * 3 * 4',
      check: (blocks: ReturnType<typeof parseNoteContent>) =>
        blocks.length === 1 &&
        deepEqual(blocks[0].tokens, [{ type: 'text', text: 'Area = 2 * 3 * 4' }]),
    },
  ];

  for (const tc of parserCases) {
    const parsed = parseNoteContent(tc.input);
    assert(tc.check(parsed), `Parser table: ${tc.name}`);
  }

  assert(
    isSafeHttpUrl('https://example.com') &&
      isSafeHttpUrl('http://localhost:3000') &&
      !isSafeHttpUrl('javascript:alert(1)') &&
      !isSafeHttpUrl('ftp://example.com'),
    'isSafeHttpUrl allows only http and https protocols'
  );

  // 2. Toggle 2nd item & byte-identical round-trip
  const originalContent = [
    'Header **summary**',
    '- [x] First done',
    '  - [ ] Second pending with <b>x</b>',
    '- [x] Third done',
    '',
    'Footer https://example.com\r',
  ].join('\n');

  const toggledOnce = toggleChecklistLine(originalContent, 2);
  const origLines = originalContent.split('\n');
  const onceLines = toggledOnce.split('\n');
  assert(
    onceLines.length === origLines.length &&
      onceLines[0] === origLines[0] &&
      onceLines[1] === origLines[1] &&
      onceLines[2] === '  - [x] Second pending with <b>x</b>' &&
      onceLines[3] === origLines[3] &&
      onceLines[4] === origLines[4] &&
      onceLines[5] === origLines[5],
    'Toggling the 2nd checklist item rewrites only that exact line'
  );

  const toggledBack = toggleChecklistLine(toggledOnce, 2);
  assert(
    toggledBack === originalContent,
    'Round-trip toggle restores byte-identical content'
  );

  // Checklist stats
  const statsBefore = getChecklistStats(originalContent);
  const statsAfter = getChecklistStats(toggledOnce);
  assert(
    statsBefore.done === 2 && statsBefore.total === 3 && statsAfter.done === 3 && statsAfter.total === 3,
    'getChecklistStats counts 2/3 done before toggle and 3/3 done after toggle'
  );

  // 3. UI Rendering + Toggle + Preserve Displayed Edit Time + Raw Toggle
  const { default: App } = await import('../src/App.tsx');
  const now = Date.now();
  const editedAgoMs = 3 * 3600_000; // 3 hours ago

  const uiNoteContent = [
    'Intro **bold** *ital* `fn()` https://example.com',
    '- [x] Item 1',
    '  - [ ] Item 2 with <b>x</b> and javascript:alert(1)',
    '- [x] Item 3',
  ].join('\n');

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
          id: 'note-fmt-1',
          title: 'Checklist & Formatting Note',
          content: uiNoteContent,
          category: 'Checklist',
          pinned: false,
          createdAt: now - 86_400_000,
          contentUpdatedAt: now - editedAgoMs,
          updatedAt: now - editedAgoMs,
        },
        {
          id: 'note-plain-1',
          title: 'Plain Note',
          content: 'Just plain notes here.',
          category: 'General',
          pinned: false,
          createdAt: now - 86_400_000,
          contentUpdatedAt: now - editedAgoMs,
          updatedAt: now - editedAgoMs,
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

  const cardPreview = document.getElementById('note-preview-note-fmt-1')!;
  const linkEl = cardPreview.querySelector('a');
  const boldEl = cardPreview.querySelector('strong');
  const emEl = cardPreview.querySelector('em');
  const codeEl = cardPreview.querySelector('code');
  const bTag = cardPreview.querySelector('b');
  const progressBadge = document.getElementById('note-checklist-progress-note-fmt-1');
  const plainProgressBadge = document.getElementById('note-checklist-progress-note-plain-1');

  assert(
    linkEl?.getAttribute('href') === 'https://example.com' &&
      linkEl?.getAttribute('target') === '_blank' &&
      linkEl?.getAttribute('rel') === 'noopener noreferrer' &&
      boldEl?.textContent === 'bold' &&
      emEl?.textContent === 'ital' &&
      codeEl?.textContent === 'fn()' &&
      bTag === null &&
      cardPreview.querySelectorAll('a').length === 1 &&
      (cardPreview.textContent || '').includes('<b>x</b>') &&
      (cardPreview.textContent || '').includes('javascript:alert(1)'),
    'Card preview renders safe links, bold/italic/code, ignores javascript: URLs, and escapes <b>x</b> as plain text'
  );

  assert(
    progressBadge?.textContent === '2/3 done' && plainProgressBadge === null,
    'Card shows "2/3 done" for checklist note and omits progress on plain notes'
  );

  const initialCardTime = document.getElementById('note-time-note-fmt-1')?.textContent;
  const checkboxes = cardPreview.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
  assert(checkboxes.length === 3 && checkboxes[1].checked === false, 'Card preview renders 3 real checkboxes');

  // Toggle 2nd checkbox on card
  await act(async () => {
    checkboxes[1].click();
  });

  const savedAfterCardToggle = JSON.parse(
    dom.window.localStorage.getItem('lifetrack_app_data_v1') || '{}'
  );
  const updatedNote = savedAfterCardToggle.notes.find((n: any) => n.id === 'note-fmt-1');
  assert(
    updatedNote.content ===
      [
        'Intro **bold** *ital* `fn()` https://example.com',
        '- [x] Item 1',
        '  - [x] Item 2 with <b>x</b> and javascript:alert(1)',
        '- [x] Item 3',
      ].join('\n') &&
      document.getElementById('note-checklist-progress-note-fmt-1')?.textContent === '3/3 done' &&
      document.getElementById('note-time-note-fmt-1')?.textContent === initialCardTime &&
      updatedNote.contentUpdatedAt === now - editedAgoMs,
    'Toggling 2nd checkbox on card rewrites exact line, updates to "3/3 done", and keeps displayed edit time unchanged'
  );

  // Open NoteDetailModal and verify checkboxes, edit time, and "Raw" monospace toggle
  await act(async () => {
    document.getElementById('note-open-note-fmt-1')?.click();
  });

  const modalContent = document.getElementById('note-detail-content')!;
  const modalTimeBefore = document.getElementById('note-detail-edited-time')?.textContent;
  const modalCheckboxes = modalContent.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
  assert(
    modalCheckboxes.length === 3 &&
      modalCheckboxes[1].checked === true &&
      document.getElementById('note-detail-checklist-progress')?.textContent === '3/3 done',
    'NoteDetailModal renders real checkboxes with 3/3 done state'
  );

  await act(async () => {
    modalCheckboxes[1].click();
  });

  assert(
    document.getElementById('note-detail-checklist-progress')?.textContent === '2/3 done' &&
      document.getElementById('note-detail-edited-time')?.textContent === modalTimeBefore,
    'Toggling 2nd checkbox in NoteDetailModal reverts to 2/3 done without changing displayed edit time'
  );

  const rawBtn = document.getElementById('note-detail-raw-toggle')!;
  assert(
    rawBtn.getAttribute('aria-pressed') === 'false' &&
      !modalContent.className.includes('font-mono'),
    'NoteDetailModal starts in formatted view with Raw toggle off'
  );

  await act(async () => {
    rawBtn.click();
  });

  const modalContentAfterRaw = document.getElementById('note-detail-content')!;
  assert(
    rawBtn.getAttribute('aria-pressed') === 'true' &&
      modalContentAfterRaw.className.includes('font-mono') &&
      modalContentAfterRaw.querySelectorAll('input[type="checkbox"]').length === 0 &&
      (modalContentAfterRaw.textContent || '').includes('Intro **bold** *ital* `fn()`') &&
      (modalContentAfterRaw.textContent || '').includes('  - [ ] Item 2 with <b>x</b>'),
    'Toggling "Raw" renders monospace plain text showing raw markdown syntax'
  );

  await act(async () => {
    rawBtn.click();
  });
  assert(
    rawBtn.getAttribute('aria-pressed') === 'false' &&
      document.getElementById('note-detail-content')!.querySelectorAll('input[type="checkbox"]').length === 3,
    'Toggling "Raw" off restores formatted checklist rendering'
  );

  await act(async () => {
    root.unmount();
  });

  console.log('--- All Note Format Parser & Checklist Tests Passed! ---');
}

await runNoteFormatTests();
