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
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runClipboardTests() {
  console.log('--- Starting Clipboard Helper & NotesView Copy Feedback Tests ---');

  let unhandledRejections = 0;
  const onUnhandled = () => {
    unhandledRejections += 1;
  };
  process.on('unhandledRejection', onUnhandled);

  const { copyText } = await import('../src/lib/clipboard.ts');
  const { NotesView } = await import('../src/components/views/NotesView.tsx');

  const origClipboardDesc = Object.getOwnPropertyDescriptor(dom.window.navigator, 'clipboard');
  const origExecCommand = (dom.window.document as any).execCommand;

  const setClipboard = (impl: { writeText: (text: string) => Promise<void> } | undefined) => {
    Object.defineProperty(dom.window.navigator, 'clipboard', {
      value: impl,
      configurable: true,
      writable: true,
    });
  };

  try {
    // 1. navigator.clipboard.writeText succeeds -> returns true
    {
      let written = '';
      setClipboard({
        writeText: async (text: string) => {
          written = text;
        },
      });
      const ok = await copyText('Formula A');
      assert(ok === true && written === 'Formula A', 'copyText returns true when clipboard.writeText succeeds');
    }

    // 2. navigator.clipboard.writeText rejects and execCommand succeeds -> falls back to textarea and returns true
    {
      let copiedValue = '';
      setClipboard({
        writeText: async () => {
          throw new Error('Permission denied');
        },
      });
      (dom.window.document as any).execCommand = (cmd: string) => {
        if (cmd !== 'copy') return false;
        const ta = dom.window.document.querySelector('textarea');
        copiedValue = ta?.value ?? '';
        return true;
      };
      const ok = await copyText('Fallback text');
      assert(
        ok === true &&
          copiedValue === 'Fallback text' &&
          dom.window.document.querySelector('textarea') === null,
        'copyText falls back to hidden textarea + execCommand and cleans up textarea'
      );
    }

    // 3. Rejecting clipboard AND failing execCommand -> returns false with zero unhandled rejections
    {
      setClipboard({
        writeText: () => Promise.reject(new Error('Clipboard unavailable')),
      });
      (dom.window.document as any).execCommand = () => false;

      const ok = await copyText('Should fail cleanly');
      await new Promise((r) => setTimeout(r, 20));
      assert(
        ok === false &&
          unhandledRejections === 0 &&
          dom.window.document.querySelector('textarea') === null,
        'rejecting clipboard returns false cleanly with no unhandled rejection'
      );
    }

    // 4. Rejecting clipboard AND throwing execCommand -> returns false with zero unhandled rejections
    {
      setClipboard({
        writeText: () => Promise.reject(new Error('NotAllowedError')),
      });
      (dom.window.document as any).execCommand = () => {
        throw new Error('execCommand blocked');
      };

      const ok = await copyText('Should also fail cleanly');
      await new Promise((r) => setTimeout(r, 20));
      assert(
        ok === false &&
          unhandledRejections === 0 &&
          dom.window.document.querySelector('textarea') === null,
        'throwing execCommand fallback returns false cleanly and removes temporary textarea'
      );
    }

    // 5. NotesView handleCopy: shows "Copy failed" (rose text, 2 s) on failure and "Copied" on success
    {
      const sampleNote: QuickNote = {
        id: 'note-copy-1',
        title: 'Bayes Rule',
        content: 'P(A|B) = P(B|A)P(A)/P(B)',
        category: 'Formulas',
        pinned: false,
        updatedAt: 1700000000000,
      };

      const mount = document.createElement('div');
      document.body.appendChild(mount);
      const root: Root = createRoot(mount);

      await act(async () => {
        root.render(
          React.createElement(NotesView, {
            notes: [sampleNote],
            onAddNote: () => {},
            onUpdateNote: () => {},
            onDeleteNote: () => {},
            onOpenAddNoteModal: () => {},
          })
        );
      });

      const origSetTimeout = globalThis.setTimeout;
      const scheduledTimers: Array<{ ms: number; cb: () => void }> = [];
      (globalThis as any).setTimeout = (fn: any, ms?: number, ...rest: any[]) => {
        if (ms === 2000) {
          const cb = () => fn(...rest);
          scheduledTimers.push({ ms, cb });
          return (80000 + scheduledTimers.length) as any;
        }
        return origSetTimeout(fn, ms, ...rest);
      };

      try {
        // Failure path
        setClipboard({
          writeText: () => Promise.reject(new Error('Clipboard rejected')),
        });
        (dom.window.document as any).execCommand = () => false;

        const copyBtn = mount.querySelector('#note-copy-note-copy-1') as HTMLButtonElement | null;
        assert(copyBtn !== null, 'NotesView renders copy button');

        await act(async () => {
          copyBtn?.click();
          await Promise.resolve();
          await Promise.resolve();
        });

        const failedLabel = copyBtn?.querySelector('span');
        assert(
          (copyBtn?.textContent || '').includes('Copy failed') &&
            !(copyBtn?.textContent || '').includes('Copied') &&
            Boolean(failedLabel?.className.includes('text-rose-600')) &&
            scheduledTimers.length === 1 &&
            scheduledTimers[0].ms === 2000,
          'NotesView displays "Copy failed" in rose text and schedules 2000ms reset on failure'
        );

        await act(async () => {
          scheduledTimers[0].cb();
        });
        assert(
          (copyBtn?.textContent || '').trim() === 'Copy',
          'NotesView resets "Copy failed" label back to "Copy" after 2 s'
        );

        // Success path
        setClipboard({
          writeText: async () => {},
        });
        await act(async () => {
          copyBtn?.click();
          await Promise.resolve();
          await Promise.resolve();
        });

        assert(
          (copyBtn?.textContent || '').includes('Copied') &&
            scheduledTimers.length === 2 &&
            scheduledTimers[1].ms === 2000,
          'NotesView displays "Copied" on clipboard success'
        );

        await act(async () => {
          scheduledTimers[1].cb();
        });
        assert(
          (copyBtn?.textContent || '').trim() === 'Copy',
          'NotesView resets "Copied" label back to "Copy" after 2 s'
        );
      } finally {
        globalThis.setTimeout = origSetTimeout;
        await act(async () => {
          root.unmount();
        });
        mount.remove();
      }
    }

    await new Promise((r) => setTimeout(r, 20));
    assert(unhandledRejections === 0, 'Zero unhandled promise rejections across all clipboard tests');
  } finally {
    process.off('unhandledRejection', onUnhandled);
    if (origClipboardDesc) {
      Object.defineProperty(dom.window.navigator, 'clipboard', origClipboardDesc);
    }
    (dom.window.document as any).execCommand = origExecCommand;
  }

  console.log('--- All Clipboard Helper & NotesView Copy Feedback Tests Passed! ---');
}

await runClipboardTests();
