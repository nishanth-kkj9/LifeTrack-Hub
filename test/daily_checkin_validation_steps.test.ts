import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import type { DailyLifeMetric } from '../src/types/index.ts';
import { getLocalDateOffset, getLocalDateString } from '../src/lib/dateUtils.ts';

const dom = new JSDOM(
  '<!DOCTYPE html><html><head><title>Daily Checkin Validation & Steps Test</title></head><body><div id="root"></div></body></html>',
  {
    url: 'http://localhost:3000',
    pretendToBeVisual: true,
  }
);

Object.defineProperty(globalThis, 'window', { value: dom.window, writable: true, configurable: true });
Object.defineProperty(globalThis, 'document', { value: dom.window.document, writable: true, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
Object.defineProperty(globalThis, 'HTMLElement', { value: dom.window.HTMLElement, writable: true, configurable: true });
Object.defineProperty(globalThis, 'HTMLInputElement', { value: dom.window.HTMLInputElement, writable: true, configurable: true });
Object.defineProperty(globalThis, 'KeyboardEvent', { value: dom.window.KeyboardEvent, writable: true, configurable: true });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

function setReactInputValue(inputEl: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(inputEl, value);
  const tracker = (inputEl as any)._valueTracker;
  if (tracker) tracker.setValue('__prev__');
  inputEl.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  inputEl.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

  const reactPropsKey = Object.keys(inputEl).find((k) => k.startsWith('__reactProps$'));
  if (reactPropsKey) {
    const props = (inputEl as any)[reactPropsKey];
    if (props?.onChange) {
      props.onChange({
        target: inputEl,
        currentTarget: inputEl,
        preventDefault: () => {},
        stopPropagation: () => {},
      });
    }
  }
}

async function runDailyCheckinValidationStepsTests() {
  console.log('--- Starting DailyLifeCheckinModal Date & Steps Tests ---');

  const { DailyLifeCheckinModal } = await import('../src/components/insights/DailyLifeCheckinModal.tsx');

  const today = new Date();
  const todayStr = getLocalDateString(today);
  const yesterdayStr = getLocalDateOffset(-1, today);
  const futureDateStr = getLocalDateOffset(2, today);

  const container = document.getElementById('root')!;
  const root: Root = createRoot(container);

  try {
    // 1. Date attributes + future date & empty date block Save
    const savedFuture: DailyLifeMetric[] = [];
    await act(async () => {
      root.render(
        React.createElement(DailyLifeCheckinModal, {
          isOpen: true,
          onClose: () => {},
          selectedDate: todayStr,
          onSaveMetric: (m) => savedFuture.push(m),
        })
      );
    });

    const dateInput = document.getElementById('checkin-date-input') as HTMLInputElement;
    const stepsInput = document.getElementById('steps-count-input') as HTMLInputElement;
    const saveBtn = document.getElementById('daily-checkin-save-btn') as HTMLButtonElement;

    assert(
      dateInput.required === true && dateInput.max === todayStr,
      `Date input has required=true and max="${todayStr}"`
    );

    // Enter valid steps so metric is non-empty, then test future & empty dates
    await act(async () => {
      setReactInputValue(stepsInput, '8500');
    });
    assert(saveBtn.disabled === false, 'Valid today date + valid steps enables Save');

    await act(async () => {
      setReactInputValue(dateInput, futureDateStr);
    });
    assert(
      saveBtn.disabled === true &&
        (container.textContent || '').includes('Future dates cannot be logged'),
      `Future date (${futureDateStr}) disables Save and shows warning`
    );

    // Force submit form with future date -> blocked
    await act(async () => {
      saveBtn.closest('form')?.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    });
    assert(savedFuture.length === 0, 'Submitting with future date does not call onSaveMetric');

    await act(async () => {
      setReactInputValue(dateInput, '');
    });
    assert(saveBtn.disabled === true, 'Empty date disables Save');

    // 2. Steps validation (out-of-range & non-integer blocked, whole 0–100000 saved)
    await act(async () => {
      setReactInputValue(dateInput, todayStr);
    });
    for (const invalidSteps of ['100001', '-5', '1234.5']) {
      await act(async () => {
        setReactInputValue(stepsInput, invalidSteps);
      });
      assert(
        saveBtn.disabled === true,
        `Invalid steps "${invalidSteps}" disables Save`
      );
    }

    await act(async () => {
      setReactInputValue(stepsInput, '8500');
    });
    assert(saveBtn.disabled === false, 'Valid whole steps 8500 enables Save');

    await act(async () => {
      saveBtn.click();
    });
    assert(
      savedFuture.length === 1 &&
        savedFuture[0].id === `metric-${todayStr}` &&
        savedFuture[0].date === todayStr &&
        savedFuture[0].stepsCount === 8500,
      `Saving valid steps stores stepsCount=8500 with id "metric-${todayStr}"`
    );

    // 3. Existing metric edit: keeps untouched fields AND keeps existing stepsCount if left blank
    const existing: DailyLifeMetric = {
      id: `metric-${yesterdayStr}`,
      date: yesterdayStr,
      sleepHours: 7,
      energyLevel: 4,
      moodLevel: 3,
      stepsCount: 6420,
      screenTimeHours: 3.5,
      journalNotes: 'Walked after class',
      updatedAt: 1700000000000,
    };

    const savedEdit: DailyLifeMetric[] = [];
    await act(async () => {
      root.render(
        React.createElement(DailyLifeCheckinModal, {
          isOpen: true,
          onClose: () => {},
          selectedDate: yesterdayStr,
          existingMetric: existing,
          onSaveMetric: (m) => savedEdit.push(m),
        })
      );
    });

    const editStepsInput = document.getElementById('steps-count-input') as HTMLInputElement;
    assert(editStepsInput.value === '6420', 'Editing existing metric prefills stepsCount=6420');

    // Clear/leave steps blank and change mood only -> existing stepsCount & untouched fields remain intact
    await act(async () => {
      setReactInputValue(editStepsInput, '');
    });
    const moodGroup = container.querySelector('[data-testid="metric-group-moodLevel"]')!;
    const mood4Btn = Array.from(moodGroup.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('4 · Happy')
    )!;
    await act(async () => {
      mood4Btn.click();
    });
    await act(async () => {
      (document.getElementById('daily-checkin-save-btn') as HTMLButtonElement).click();
    });

    assert(savedEdit.length === 1, 'Edited metric saved once');
    const res = savedEdit[0];
    assert(
      res.id === `metric-${yesterdayStr}` &&
        res.date === yesterdayStr &&
        res.moodLevel === 4 &&
        res.sleepHours === 7 &&
        res.energyLevel === 4 &&
        res.stepsCount === 6420 &&
        res.screenTimeHours === 3.5 &&
        res.journalNotes === 'Walked after class',
      'Editing existing metric preserves untouched fields and keeps existing stepsCount=6420 when steps input is left blank'
    );
  } finally {
    await act(async () => {
      root.unmount();
    });
    container.innerHTML = '';
  }

  console.log('--- All DailyLifeCheckinModal Date & Steps Tests Passed! ---');
}

await runDailyCheckinValidationStepsTests();
