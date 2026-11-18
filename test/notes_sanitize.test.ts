import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { sanitizeUserAppData, EMPTY_USER_DATA } from '../src/lib/firebase.ts';
import { QuickNote } from '../src/types/index.ts';

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
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

function setReactInputValue(el: HTMLInputElement, value: string) {
  const proto = dom.window.HTMLInputElement.prototype;
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

function makeBasePayload(overrides: Record<string, unknown> = {}) {
  return {
    ...EMPTY_USER_DATA,
    ...overrides,
  };
}

async function runNotesSanitizeTests() {
  console.log('--- Starting Notes Sanitization & Defensive UI Tests ---');

  const { NotesView } = await import('../src/components/views/NotesView.tsx');
  const { CommandPalette } = await import('../src/components/common/CommandPalette.tsx');

  // 1. { id: 'b1', pinned: 'yes' } is repaired instead of dropped
  {
    const { data, repaired } = sanitizeUserAppData(
      makeBasePayload({
        notes: [{ id: 'b1', pinned: 'yes' }],
      })
    );
    assert(repaired === true, 'malformed {id:"b1", pinned:"yes"} sets repaired=true');
    assert(data.notes.length === 1, 'malformed {id:"b1", pinned:"yes"} is kept');
    const note = data.notes[0];
    assert(
      note.id === 'b1' &&
        note.title === 'Untitled' &&
        note.content === '' &&
        note.pinned === false &&
        note.updatedAt === 0 &&
        note.category === undefined &&
        note.deletedAt === undefined,
      'malformed {id:"b1", pinned:"yes"} repairs title="Untitled", content="", pinned=false, updatedAt=0'
    );
  }

  // 2. Missing title falls back to first 40 chars of content, else "Untitled"
  {
    const longContent = 'Fourier transform pairs and Parseval theorem derivation notes for DSP exam';
    const { data, repaired } = sanitizeUserAppData(
      makeBasePayload({
        notes: [
          {
            id: 'n-missing-title-long',
            content: longContent,
            pinned: false,
            updatedAt: 1700000000000,
          },
          {
            id: 'n-missing-title-empty',
            content: '   ',
            pinned: true,
            updatedAt: 1700000000000,
          },
        ],
      })
    );
    assert(repaired === true && data.notes.length === 2, 'missing title triggers repair and keeps notes');
    assert(
      data.notes[0].title === longContent.slice(0, 40) && data.notes[0].title.length === 40,
      'missing title falls back to first 40 chars of content'
    );
    assert(
      data.notes[1].title === 'Untitled',
      'missing title with whitespace-only content falls back to "Untitled"'
    );
  }

  // 3. Missing content repairs to ""
  {
    const { data, repaired } = sanitizeUserAppData(
      makeBasePayload({
        notes: [
          {
            id: 'n-missing-content',
            title: 'Formula Sheet',
            pinned: true,
            updatedAt: 1700000000000,
          },
        ],
      })
    );
    assert(repaired === true && data.notes.length === 1, 'missing content repairs note and sets repaired=true');
    assert(
      data.notes[0].content === '' && data.notes[0].title === 'Formula Sheet' && data.notes[0].pinned === true,
      'missing content defaults to "" while preserving valid title and pinned'
    );
  }

  // 4. Number title repairs to first 40 chars of content or "Untitled"
  {
    const { data, repaired } = sanitizeUserAppData(
      makeBasePayload({
        notes: [
          {
            id: 'n-num-title-1',
            title: 12345,
            content: 'Ohm law V = I * R',
            pinned: false,
            updatedAt: 1700000000000,
          },
          {
            id: 'n-num-title-2',
            title: 999,
            content: '',
            pinned: false,
            updatedAt: 1700000000000,
          },
        ],
      })
    );
    assert(repaired === true && data.notes.length === 2, 'numeric title triggers repair');
    assert(
      data.notes[0].title === 'Ohm law V = I * R',
      'numeric title falls back to content prefix when content is present'
    );
    assert(
      data.notes[1].title === 'Untitled',
      'numeric title with empty content falls back to "Untitled"'
    );
  }

  // 5. Invalid id items are dropped; invalid category / non-finite updatedAt / non-finite deletedAt are repaired
  {
    const { data, repaired } = sanitizeUserAppData(
      makeBasePayload({
        notes: [
          { id: '', title: 'Empty ID', content: 'x', pinned: false, updatedAt: 10 },
          { id: '   ', title: 'Blank ID', content: 'x', pinned: false, updatedAt: 10 },
          { id: 42, title: 'Numeric ID', content: 'x', pinned: false, updatedAt: 10 },
          {
            id: 'n-bad-meta',
            title: 'Valid Title',
            content: 'Body',
            category: 999,
            pinned: false,
            updatedAt: Number.NaN,
            deletedAt: 'yesterday',
          },
        ],
      })
    );
    assert(repaired === true && data.notes.length === 1, 'drops empty/blank/non-string ids and sets repaired=true');
    const kept = data.notes[0];
    assert(
      kept.id === 'n-bad-meta' &&
        kept.category === undefined &&
        kept.updatedAt === 0 &&
        kept.deletedAt === undefined,
      'invalid category removed, non-finite updatedAt repaired to 0, non-finite deletedAt removed'
    );
  }

  // 6. Valid note passes through unchanged with repaired=false
  {
    const validNote: QuickNote = {
      id: 'n-valid',
      title: 'Signals & Systems',
      content: 'x(t) * h(t) = y(t)',
      category: 'Study',
      pinned: true,
      updatedAt: 1700000001234,
    };
    const { data, repaired } = sanitizeUserAppData(
      makeBasePayload({
        notes: [validNote],
      })
    );
    assert(repaired === false, 'valid note produces repaired=false');
    assert(
      data.notes.length === 1 &&
        data.notes[0].id === validNote.id &&
        data.notes[0].title === validNote.title &&
        data.notes[0].content === validNote.content &&
        data.notes[0].category === validNote.category &&
        data.notes[0].pinned === validNote.pinned &&
        data.notes[0].updatedAt === validNote.updatedAt &&
        !('deletedAt' in data.notes[0]),
      'valid note is preserved unchanged'
    );
  }

  // 7. Tombstoned note keeps finite deletedAt untouched
  {
    const tombstoned: QuickNote = {
      id: 'n-tombstone',
      title: 'Archived Formula',
      content: 'E = mc^2',
      pinned: false,
      updatedAt: 1700000002000,
      deletedAt: 1700000005000,
    };
    const { data, repaired } = sanitizeUserAppData(
      makeBasePayload({
        notes: [tombstoned],
      })
    );
    assert(repaired === false, 'valid tombstoned note leaves repaired=false');
    assert(
      data.notes.length === 1 && data.notes[0].deletedAt === 1700000005000,
      'tombstoned note keeps finite deletedAt'
    );
  }

  // 8. Defensive rendering and searching in NotesView and CommandPalette with un-sanitized malformed notes
  {
    const malformedNotes = [
      { id: 'raw-1', pinned: 'yes' },
      { id: 'raw-2', title: 404, content: null, category: { bad: true }, updatedAt: 'bad' },
    ] as unknown as QuickNote[];

    const mount = document.createElement('div');
    document.body.appendChild(mount);
    const root = createRoot(mount);

    await act(async () => {
      root.render(
        React.createElement(NotesView, {
          notes: malformedNotes,
          onAddNote: () => {},
          onUpdateNote: () => {},
          onDeleteNote: () => {},
          onOpenAddNoteModal: () => {},
        })
      );
    });

    assert(
      Boolean(mount.querySelector('#note-card-raw-1')) && Boolean(mount.querySelector('#note-card-raw-2')),
      'NotesView renders malformed notes safely without throwing'
    );

    const notesSearch = mount.querySelector('#notes-search-input') as HTMLInputElement | null;
    await act(async () => {
      if (notesSearch) setReactInputValue(notesSearch, '404');
    });
    assert(
      !mount.querySelector('#note-card-raw-1') && Boolean(mount.querySelector('#note-card-raw-2')),
      'NotesView search safely coerces numeric title and null content'
    );

    await act(async () => {
      root.render(
        React.createElement(CommandPalette, {
          isOpen: true,
          onClose: () => {},
          onNavigate: () => {},
          tasks: [],
          exams: [],
          habits: [],
          notes: malformedNotes,
          onOpenAddTask: () => {},
          onOpenAddTransaction: () => {},
          onOpenAddExam: () => {},
          onOpenAddNote: () => {},
        })
      );
    });

    const paletteSearch = mount.querySelector('input') as HTMLInputElement | null;
    await act(async () => {
      if (paletteSearch) setReactInputValue(paletteSearch, '404');
    });
    assert(
      (mount.textContent || '').includes('404'),
      'CommandPalette renders and filters malformed notes safely without throwing'
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 40));
      root.unmount();
    });
    mount.remove();
  }

  console.log('--- All Notes Sanitization & Defensive UI Tests Passed ---');
}

await runNotesSanitizeTests();
