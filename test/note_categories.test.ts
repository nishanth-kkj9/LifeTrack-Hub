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
Object.defineProperty(globalThis, 'HTMLSelectElement', { value: dom.window.HTMLSelectElement, writable: true, configurable: true });
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

function setReactControlValue(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string
) {
  const proto =
    el instanceof dom.window.HTMLTextAreaElement
      ? dom.window.HTMLTextAreaElement.prototype
      : el instanceof dom.window.HTMLSelectElement
      ? dom.window.HTMLSelectElement.prototype
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

async function runNoteCategoryTests() {
  console.log('--- Starting Note Categories & Validation Tests ---');

  const {
    NOTE_CATEGORIES,
    getNoteCategories,
    validateNewNoteCategory,
    NEW_CATEGORY_OPTION_VALUE,
    MAX_NOTE_CATEGORY_LENGTH,
  } = await import('../src/lib/noteCategories.ts');
  const { AddNoteModal } = await import('../src/components/modals/AddNoteModal.tsx');
  const { NotesView } = await import('../src/components/views/NotesView.tsx');

  // 1. Canonical NOTE_CATEGORIES & getNoteCategories helper
  {
    assert(
      JSON.stringify(NOTE_CATEGORIES) ===
        JSON.stringify([
          { id: 'Formulas', label: 'Formulas & Math' },
          { id: 'Study', label: 'Study & Exams' },
          { id: 'Ideas', label: 'Ideas' },
          { id: 'Checklist', label: 'Checklist' },
          { id: 'Finance', label: 'Finance & Life' },
          { id: 'General', label: 'General' },
        ]),
      'NOTE_CATEGORIES matches canonical list with unchanged ids'
    );

    const combined = getNoteCategories([
      {
        id: 'n1',
        title: 'Quantum',
        content: 'H psi = E psi',
        category: 'Physics 101',
        pinned: false,
        updatedAt: 1000,
      },
      {
        id: 'n2',
        title: 'Duplicate case',
        content: 'test',
        category: 'physics 101',
        pinned: false,
        updatedAt: 1000,
      },
      {
        id: 'n3',
        title: 'Existing preset',
        content: 'test',
        category: 'Finance',
        pinned: false,
        updatedAt: 1000,
      },
    ]);
    assert(
      combined.length === 7 &&
        combined[6].id === 'Physics 101' &&
        combined[6].label === 'Physics 101',
      'getNoteCategories appends custom categories case-insensitively without duplicating presets'
    );

    const dupRes = validateNewNoteCategory('  finance ', NOTE_CATEGORIES);
    const tooLongRes = validateNewNoteCategory('A'.repeat(MAX_NOTE_CATEGORY_LENGTH + 1), NOTE_CATEGORIES);
    const validRes = validateNewNoteCategory('  Physics 101  ', NOTE_CATEGORIES);
    assert(
      !dupRes.ok && !tooLongRes.ok && validRes.ok && validRes.category === 'Physics 101',
      'validateNewNoteCategory trims, enforces max 24 chars, and rejects case-insensitive duplicates'
    );
  }

  // 2. Editing a Finance note shows Finance in the in-card edit select
  {
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    const root: Root = createRoot(mount);

    const financeNote: QuickNote = {
      id: 'note-fin-1',
      title: 'Emergency Fund Target',
      content: '6 months expenses',
      category: 'Finance',
      pinned: false,
      updatedAt: 1700000000000,
    };

    await act(async () => {
      root.render(
        React.createElement(NotesView, {
          notes: [financeNote],
          onAddNote: () => {},
          onUpdateNote: () => {},
          onDeleteNote: () => {},
          onOpenAddNoteModal: () => {},
        })
      );
    });

    await act(async () => {
      (mount.querySelector('#note-edit-note-fin-1') as HTMLButtonElement | null)?.click();
    });

    const editSelect = mount.querySelector('#note-edit-category-note-fin-1') as HTMLSelectElement | null;
    assert(
      editSelect !== null && editSelect.value === 'Finance',
      'Editing a Finance note displays Finance selected in the edit dropdown'
    );

    await act(async () => {
      root.unmount();
    });
    mount.remove();
  }

  // 3. AddNoteModal: body textarea is not required, title-only note saves, and creating "Physics 101" appears as a tab in NotesView
  {
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    const root: Root = createRoot(mount);

    let notesList: QuickNote[] = [];
    let isModalOpen = true;

    const renderHarness = async () => {
      await act(async () => {
        root.render(
          React.createElement(
            React.Fragment,
            null,
            React.createElement(NotesView, {
              notes: notesList,
              onAddNote: (n: QuickNote) => {
                notesList = [n, ...notesList];
              },
              onUpdateNote: (updated: QuickNote) => {
                notesList = notesList.map((n) => (n.id === updated.id ? updated : n));
              },
              onDeleteNote: () => {},
              onOpenAddNoteModal: () => {
                isModalOpen = true;
              },
            }),
            React.createElement(AddNoteModal, {
              isOpen: isModalOpen,
              notes: notesList,
              onClose: () => {
                isModalOpen = false;
              },
              onAddNote: (n: QuickNote) => {
                notesList = [n, ...notesList];
              },
            })
          )
        );
      });
    };

    await renderHarness();

    const bodyTextarea = mount.querySelector('#note-content-input') as HTMLTextAreaElement | null;
    const titleInput = mount.querySelector('#note-title-input') as HTMLInputElement | null;
    const categorySelect = mount.querySelector('#note-category-select') as HTMLSelectElement | null;
    const modalForm = mount.querySelector('#add-note-modal-card form') as HTMLFormElement | null;

    assert(
      bodyTextarea !== null &&
        bodyTextarea.hasAttribute('required') === false &&
        titleInput !== null &&
        titleInput.hasAttribute('required') === false,
      'AddNoteModal does not set required attribute on body textarea or title input'
    );

    // Choose "+ New category...", type "  Physics 101  ", and save a title-only note
    await act(async () => {
      if (categorySelect) setReactControlValue(categorySelect, NEW_CATEGORY_OPTION_VALUE);
    });

    const newCatInput = mount.querySelector('#note-new-category-input') as HTMLInputElement | null;
    assert(
      newCatInput !== null && newCatInput.maxLength === 24,
      'Selecting "+ New category..." reveals text input with maxLength=24'
    );

    await act(async () => {
      if (titleInput) setReactControlValue(titleInput, 'Kinematics Title Only');
      if (newCatInput) setReactControlValue(newCatInput, '  Physics 101  ');
    });
    await act(async () => {
      modalForm?.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    });
    await renderHarness();

    assert(
      notesList.length === 1 &&
        notesList[0].title === 'Kinematics Title Only' &&
        notesList[0].content === '' &&
        notesList[0].category === 'Physics 101',
      'Title-only note saves with trimmed custom category "Physics 101"'
    );

    // Verify "Physics 101 (1)" tab immediately appears in NotesView
    const tabTexts = Array.from(mount.querySelectorAll('#notes-view-container button')).map((b) =>
      b.textContent?.trim()
    );
    assert(
      tabTexts.includes('Physics 101 (1)'),
      'Creating "Physics 101" note renders "Physics 101 (1)" tab in NotesView'
    );

    // Also verify content-only note falls back title to first 40 chars of content
    isModalOpen = true;
    await renderHarness();
    const contentOnlyStr = 'First line of content-only scratchpad note exceeding forty chars';
    await act(async () => {
      const tIn = mount.querySelector('#note-title-input') as HTMLInputElement;
      const cIn = mount.querySelector('#note-content-input') as HTMLTextAreaElement;
      setReactControlValue(tIn, '');
      setReactControlValue(cIn, contentOnlyStr);
    });
    await act(async () => {
      mount
        .querySelector('#add-note-modal-card form')
        ?.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    });
    await renderHarness();

    assert(
      notesList.length === 2 &&
        notesList[0].title === contentOnlyStr.slice(0, 40) &&
        notesList[0].content === contentOnlyStr,
      'Content-only note in AddNoteModal saves with title falling back to first 40 chars of content'
    );

    // Case-insensitive duplicate check in UI ("physics 101" rejected)
    isModalOpen = true;
    await renderHarness();
    await act(async () => {
      const sel = mount.querySelector('#note-category-select') as HTMLSelectElement;
      setReactControlValue(sel, NEW_CATEGORY_OPTION_VALUE);
    });
    await act(async () => {
      const newCat = mount.querySelector('#note-new-category-input') as HTMLInputElement;
      setReactControlValue(newCat, 'physics 101');
    });
    await act(async () => {
      (mount.querySelector('#note-new-category-add-btn') as HTMLButtonElement | null)?.click();
    });
    assert(
      (mount.querySelector('#add-note-modal-card')?.textContent || '').includes('already exists'),
      'Duplicate case-insensitive custom category shows inline validation error'
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
      root.unmount();
    });
    mount.remove();
  }

  console.log('--- All Note Categories & Validation Tests Passed! ---');
}

await runNoteCategoryTests();
