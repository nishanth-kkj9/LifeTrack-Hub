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
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

function setReactInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
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

async function runNoteTimestampTests() {
  console.log('--- Starting Note Timestamps, UUID, Pinning & RelativeTimeFormat Tests ---');

  const { sanitizeUserAppData, EMPTY_USER_DATA } = await import('../src/lib/firebase.ts');
  const { AddNoteModal } = await import('../src/components/modals/AddNoteModal.tsx');
  const { NotesView, formatNoteRelativeTime } = await import('../src/components/views/NotesView.tsx');

  // 1. Sanitizer keeps finite createdAt / contentUpdatedAt and strips non-finite ones
  {
    const { data, repaired } = sanitizeUserAppData({
      ...EMPTY_USER_DATA,
      notes: [
        {
          id: 'note-valid-created',
          title: 'Valid CreatedAt',
          content: 'Body',
          pinned: false,
          createdAt: 1700000000000,
          contentUpdatedAt: 1700000005000,
          updatedAt: 1700000010000,
        },
        {
          id: 'note-bad-created',
          title: 'Bad CreatedAt',
          content: 'Body',
          pinned: false,
          createdAt: 'not-a-number',
          contentUpdatedAt: Number.POSITIVE_INFINITY,
          updatedAt: 1700000010000,
        },
      ],
    });
    assert(repaired === true && data.notes.length === 2, 'sanitizer repairs invalid createdAt/contentUpdatedAt');
    assert(
      data.notes[0].createdAt === 1700000000000 &&
        data.notes[0].contentUpdatedAt === 1700000005000,
      'sanitizer keeps finite createdAt and contentUpdatedAt'
    );
    assert(
      data.notes[1].createdAt === undefined && data.notes[1].contentUpdatedAt === undefined,
      'sanitizer drops non-finite createdAt and contentUpdatedAt'
    );
  }

  // 2. Relative time helper: missing timestamp -> "", past timestamp -> Intl.RelativeTimeFormat
  {
    assert(formatNoteRelativeTime(undefined) === '', 'missing timestamp returns ""');
    assert(formatNoteRelativeTime(0) === '', 'zero timestamp returns ""');
    assert(formatNoteRelativeTime(Number.NaN) === '', 'NaN timestamp returns ""');

    const now = 1700000000000;
    const expected3Days = new Intl.RelativeTimeFormat(dom.window.navigator.language || undefined, {
      numeric: 'auto',
    }).format(-3, 'day');
    assert(
      formatNoteRelativeTime(now - 3 * 24 * 60 * 60 * 1000, now) === expected3Days,
      'formatNoteRelativeTime matches Intl.RelativeTimeFormat for browser locale'
    );
  }

  // 3. New note via AddNoteModal sets createdAt = updatedAt = Date.now() and note-prefixed UUID
  {
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    const root: Root = createRoot(mount);
    const added: QuickNote[] = [];

    await act(async () => {
      root.render(
        React.createElement(AddNoteModal, {
          isOpen: true,
          onClose: () => {},
          onAddNote: (n: QuickNote) => added.push(n),
        })
      );
    });

    const titleInput = mount.querySelector('#note-title-input') as HTMLInputElement;
    const contentInput = mount.querySelector('#note-content-input') as HTMLTextAreaElement;
    const form = mount.querySelector('form') as HTMLFormElement;

    const before = Date.now();
    await act(async () => {
      setReactInputValue(titleInput, 'Euler Identity');
      setReactInputValue(contentInput, 'e^(i*pi) + 1 = 0');
    });
    await act(async () => {
      form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    });
    const after = Date.now();

    assert(added.length === 1, 'AddNoteModal submits new note');
    const created = added[0];
    assert(
      /^note-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(created.id),
      'New note id uses crypto.randomUUID() prefixed with "note-"'
    );
    assert(
      typeof created.createdAt === 'number' &&
        created.createdAt === created.updatedAt &&
        created.createdAt >= before &&
        created.createdAt <= after,
      'New note sets createdAt === updatedAt within Date.now() bounds'
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
      root.unmount();
    });
    mount.remove();
  }

  // 4. Pinning preserves displayed time; editing text updates displayed time; old notes sort cleanly
  {
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    const root: Root = createRoot(mount);

    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000;
    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;

    let currentNotes: QuickNote[] = [
      // Old note without createdAt or contentUpdatedAt (older)
      {
        id: 'old-note-1',
        title: 'Old Note Older',
        content: 'Old content 1',
        category: 'General',
        pinned: false,
        updatedAt: fiveDaysAgo,
      },
      // Old note without createdAt or contentUpdatedAt (newer)
      {
        id: 'old-note-2',
        title: 'Old Note Newer',
        content: 'Old content 2',
        category: 'General',
        pinned: false,
        updatedAt: twoDaysAgo,
      },
      // Target note for pin + edit test
      {
        id: 'note-pin-edit',
        title: 'Laplace Table',
        content: 'L{1} = 1/s',
        category: 'Formulas',
        pinned: false,
        createdAt: threeDaysAgo,
        contentUpdatedAt: threeDaysAgo,
        updatedAt: threeDaysAgo,
      },
      // Note with missing timestamp -> must display "" and never "Just now"
      {
        id: 'note-no-ts',
        title: 'Undated Note',
        content: 'No timestamp here',
        category: 'General',
        pinned: false,
        updatedAt: 0,
      },
    ];

    const renderView = async () => {
      await act(async () => {
        root.render(
          React.createElement(NotesView, {
            notes: currentNotes,
            onAddNote: (n: QuickNote) => {
              currentNotes = [n, ...currentNotes];
            },
            onUpdateNote: (updated: QuickNote) => {
              currentNotes = currentNotes.map((n) => (n.id === updated.id ? updated : n));
            },
            onDeleteNote: () => {},
            onOpenAddNoteModal: () => {},
          })
        );
      });
    };

    await renderView();

    // Verify sorting of old notes without new fields: old-note-2 (2d ago) before note-pin-edit (3d ago) before old-note-1 (5d ago) before note-no-ts (0)
    const renderedCardIds = Array.from(mount.querySelectorAll('[id^="note-card-"]')).map((el) =>
      el.id.replace('note-card-', '')
    );
    assert(
      renderedCardIds[0] === 'old-note-2' &&
        renderedCardIds[1] === 'note-pin-edit' &&
        renderedCardIds[2] === 'old-note-1' &&
        renderedCardIds[3] === 'note-no-ts',
      'Old notes without createdAt/contentUpdatedAt sort accurately under Recent updates'
    );

    // Missing timestamp note shows "" (no #note-time element and no "Just now")
    const noTsCardText = mount.querySelector('#note-card-note-no-ts')?.textContent || '';
    assert(
      mount.querySelector('#note-time-note-no-ts') === null && !noTsCardText.includes('Just now'),
      'Missing timestamp renders empty string instead of "Just now"'
    );

    const timeBeforePin = mount.querySelector('#note-time-note-pin-edit')?.textContent || '';
    const updatedBeforePin = currentNotes.find((n) => n.id === 'note-pin-edit')!.updatedAt;

    // Wait 2ms so Date.now() advances cleanly
    await new Promise((r) => setTimeout(r, 5));

    // Pin note-pin-edit
    await act(async () => {
      (mount.querySelector('#note-pin-note-pin-edit') as HTMLButtonElement | null)?.click();
    });
    await renderView();

    const pinnedNote = currentNotes.find((n) => n.id === 'note-pin-edit')!;
    const timeAfterPin = mount.querySelector('#note-time-note-pin-edit')?.textContent || '';
    assert(
      pinnedNote.pinned === true &&
        pinnedNote.updatedAt > updatedBeforePin &&
        pinnedNote.contentUpdatedAt === threeDaysAgo &&
        timeAfterPin === timeBeforePin &&
        timeAfterPin.length > 0,
      'Pinning updates pinned and sync updatedAt via touch() while keeping contentUpdatedAt and displayed time unchanged'
    );

    // Unpin note-pin-edit and verify sort still uses contentUpdatedAt (not the newer pin updatedAt!)
    await act(async () => {
      (mount.querySelector('#note-pin-note-pin-edit') as HTMLButtonElement | null)?.click();
    });
    await renderView();

    const idsAfterUnpin = Array.from(mount.querySelectorAll('[id^="note-card-"]')).map((el) =>
      el.id.replace('note-card-', '')
    );
    assert(
      idsAfterUnpin[0] === 'old-note-2' && idsAfterUnpin[1] === 'note-pin-edit',
      'After unpinning, note still sorts by contentUpdatedAt rather than pin sync stamp'
    );

    // Edit text of note-pin-edit -> contentUpdatedAt and displayed time must update
    await act(async () => {
      (mount.querySelector('#note-edit-note-pin-edit') as HTMLButtonElement | null)?.click();
    });

    const editTextarea = mount.querySelector('#note-card-note-pin-edit textarea') as HTMLTextAreaElement | null;
    const saveEditBtn = Array.from(
      mount.querySelectorAll('#note-card-note-pin-edit button')
    ).find((b) => b.textContent?.trim() === 'Save') as HTMLButtonElement | undefined;

    await act(async () => {
      if (editTextarea) setReactInputValue(editTextarea, 'L{1} = 1/s, L{t} = 1/s^2');
    });
    const editAt = Date.now();
    await act(async () => {
      saveEditBtn?.click();
    });
    await renderView();

    const editedNote = currentNotes.find((n) => n.id === 'note-pin-edit')!;
    const timeAfterEdit = mount.querySelector('#note-time-note-pin-edit')?.textContent || '';
    assert(
      typeof editedNote.contentUpdatedAt === 'number' &&
        editedNote.contentUpdatedAt >= editAt &&
        timeAfterEdit !== timeBeforePin &&
        timeAfterEdit.length > 0,
      'Editing text updates contentUpdatedAt and changes displayed relative time'
    );

    await act(async () => {
      root.unmount();
    });
    mount.remove();
  }

  console.log('--- All Note Timestamps, UUID, Pinning & RelativeTimeFormat Tests Passed! ---');
}

await runNoteTimestampTests();
