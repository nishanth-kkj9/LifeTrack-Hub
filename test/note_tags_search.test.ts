import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import {
  extractTags,
  normalizeForSearch,
  splitHighlightSegments,
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

async function runNoteTagsSearchTests() {
  console.log('--- Starting Note #Tags, NFD Accent Search & Safe Highlight Tests ---');

  // 1. extractTags pure helper tests
  assert(
    JSON.stringify(extractTags('#exam study\n#math-101 #Exam #calc_2 https://example.com#frag')) ===
      JSON.stringify(['exam', 'math-101', 'calc_2']),
    'extractTags extracts unique #tags via /(^|\\s)#([\\p{L}\\p{N}_-]{1,24})/gu and ignores URL fragments'
  );

  assert(
    JSON.stringify(extractTags('Visit #café and #répéter')) === JSON.stringify(['café', 'répéter']),
    'extractTags supports Unicode accented letters'
  );

  assert(
    extractTags('#abcdefghijklmnopqrstuvwxyz')[0].length === 24,
    'extractTags enforces 24-char tag limit'
  );

  // 2. NFD normalization & safe highlighting (including regex characters)
  assert(
    normalizeForSearch('Café Menu') === 'cafe menu' &&
      normalizeForSearch('Cafe\u0301') === 'cafe',
    'normalizeForSearch ignores case and NFD accents'
  );

  const nfcSegs = splitHighlightSegments('Morning café espresso', 'cafe');
  assert(
    JSON.stringify(nfcSegs) ===
      JSON.stringify([
        { text: 'Morning ', highlight: false },
        { text: 'café', highlight: true },
        { text: ' espresso', highlight: false },
      ]),
    'splitHighlightSegments maps "cafe" back to exact NFC "café" slice'
  );

  const nfdSegs = splitHighlightSegments('Cafe\u0301 latte', 'cafe');
  assert(
    JSON.stringify(nfdSegs) ===
      JSON.stringify([
        { text: 'Cafe\u0301', highlight: true },
        { text: ' latte', highlight: false },
      ]),
    'splitHighlightSegments preserves combining accent inside NFD highlighted segment'
  );

  const parenSegs = splitHighlightSegments('Array fn(items[0])', '(');
  const bracketSegs = splitHighlightSegments('Array fn(items[0])', '[');
  assert(
    parenSegs.some((s) => s.highlight && s.text === '(') &&
      bracketSegs.some((s) => s.highlight && s.text === '['),
    'splitHighlightSegments handles regex special chars "(" and "[" without throwing'
  );

  // 3. UI Integration tests
  const { default: App } = await import('../src/App.tsx');
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
          id: 'note-tag-1',
          title: 'Midterm Checklist',
          content: 'Revise chapters 1-4 #exam #physics #calculus #formulas #urgent',
          category: 'Study',
          pinned: false,
          createdAt: now - 3600_000,
          contentUpdatedAt: now - 3600_000,
          updatedAt: now - 3600_000,
        },
        {
          id: 'note-tag-2',
          title: 'Coffee Spots',
          content: 'Best café near campus with quiet WiFi #lifestyle',
          category: 'General',
          pinned: false,
          createdAt: now - 7200_000,
          contentUpdatedAt: now - 7200_000,
          updatedAt: now - 7200_000,
        },
        {
          id: 'note-tag-3',
          title: 'Parser Edge Note',
          content: 'Call fn(a[0]) safely #regex',
          category: 'Formulas',
          pinned: false,
          createdAt: now - 10_800_000,
          contentUpdatedAt: now - 10_800_000,
          updatedAt: now - 10_800_000,
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

  // Check up to 3 tag chips rendered on note-tag-1 (which has 5 #tags)
  const tagChips1 = document.querySelectorAll('#note-tags-note-tag-1 button');
  assert(
    tagChips1.length === 3 &&
      tagChips1[0].textContent === '#exam' &&
      tagChips1[1].textContent === '#physics' &&
      tagChips1[2].textContent === '#calculus' &&
      document.getElementById('notes-results-count')?.textContent === '3 results',
    'Card shows up to 3 tag chips and "3 results" renders next to search box'
  );

  // Clicking tag chip filters notes; clicking again restores
  await act(async () => {
    (tagChips1[0] as HTMLButtonElement).click();
  });
  assert(
    document.getElementById('note-card-note-tag-1') !== null &&
      document.getElementById('note-card-note-tag-2') === null &&
      document.getElementById('notes-results-count')?.textContent === '1 result',
    'Clicking #exam tag chip filters to matching note and updates "1 result"'
  );

  await act(async () => {
    document.getElementById('notes-active-tag-filter')?.click();
  });
  assert(
    document.getElementById('notes-results-count')?.textContent === '3 results',
    'Clearing active tag filter restores all 3 results'
  );

  // Search "exam" finds #exam note and highlights <mark>
  const searchInput = document.getElementById('notes-search-input') as HTMLInputElement;
  await act(async () => {
    setReactInputValue(searchInput, 'exam');
  });
  const marksExam = Array.from(
    document.querySelectorAll('#note-card-note-tag-1 mark')
  ).map((m) => m.textContent);
  assert(
    document.getElementById('note-card-note-tag-1') !== null &&
      document.getElementById('note-card-note-tag-2') === null &&
      document.getElementById('notes-results-count')?.textContent === '1 result' &&
      marksExam.includes('exam'),
    'Searching "exam" finds "#exam" note, updates "1 result", and highlights via <mark>'
  );

  // Search "cafe" matches "café" via NFD and highlights "café"
  await act(async () => {
    setReactInputValue(searchInput, 'cafe');
  });
  const marksCafe = Array.from(
    document.querySelectorAll('#note-card-note-tag-2 mark')
  ).map((m) => m.textContent);
  assert(
    document.getElementById('note-card-note-tag-2') !== null &&
      document.getElementById('note-card-note-tag-1') === null &&
      marksCafe.includes('café'),
    'Searching "cafe" matches "café" (NFD accent-insensitive) and highlights "café" in <mark>'
  );

  // Search "(" and "[" safely highlights without regex crash
  for (const ch of ['(', '[']) {
    await act(async () => {
      setReactInputValue(searchInput, ch);
    });
    const marksSpecial = Array.from(
      document.querySelectorAll('#note-card-note-tag-3 mark')
    ).map((m) => m.textContent);
    assert(
      document.getElementById('note-card-note-tag-3') !== null &&
        marksSpecial.includes(ch),
      `Searching "${ch}" matches and highlights safely via React <mark> without regex error`
    );
  }

  // Verify no new persisted fields added on QuickNote in localStorage
  const stored = JSON.parse(dom.window.localStorage.getItem('lifetrack_app_data_v1') || '{}');
  assert(
    stored.notes.every((n: Record<string, unknown>) => !('tags' in n)),
    'No persisted tags field added to QuickNote in localStorage'
  );

  await act(async () => {
    root.unmount();
  });

  console.log('--- All Note #Tags, NFD Accent Search & Safe Highlight Tests Passed! ---');
}

await runNoteTagsSearchTests();
