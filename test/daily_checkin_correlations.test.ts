import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import type { DailyLifeMetric } from '../src/types/index.ts';

const dom = new JSDOM(
  '<!DOCTYPE html><html><head><title>Daily Checkin Test</title></head><body><div id="root"></div></body></html>',
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

async function runDailyCheckinAndCorrelationTests() {
  console.log('--- Starting DailyLifeCheckinModal & Correlation Missing-Field Tests ---');

  const { DailyLifeCheckinModal } = await import('../src/components/insights/DailyLifeCheckinModal.tsx');
  const {
    summarizeWeeklyMetrics,
    buildWeeklySummary,
    generateInsights,
    getWeeklyTrend,
  } = await import('../src/lib/analytics.ts');
  const {
    calculatePearsonCorrelation,
    analyzeLifeMetricCorrelations,
  } = await import('../src/lib/correlationEngine.ts');

  const container = document.getElementById('root')!;
  let root: Root | null = createRoot(container);

  try {
    // 1. Untouched modal starts unset and cannot save
    const savedCalls1: DailyLifeMetric[] = [];
    await act(async () => {
      root!.render(
        React.createElement(DailyLifeCheckinModal, {
          isOpen: true,
          onClose: () => {},
          selectedDate: '2026-11-16',
          onSaveMetric: (m) => savedCalls1.push(m),
        })
      );
    });

    const saveBtn = document.getElementById('daily-checkin-save-btn') as HTMLButtonElement | null;
    assert(saveBtn !== null && saveBtn.disabled === true, 'Untouched modal has Save button disabled');

    const sleepBadge = container.querySelector('[data-testid="sleep-hours-value"]');
    const stressSelect = document.getElementById('stress-level-select') as HTMLSelectElement | null;
    const waterInput = document.getElementById('water-litres-input') as HTMLInputElement | null;
    const focusInput = document.getElementById('focus-hours-input') as HTMLInputElement | null;
    assert(
      sleepBadge?.textContent?.trim() === 'Not set' &&
        stressSelect?.value === '' &&
        waterInput?.value === '' &&
        focusInput?.value === '',
      'All numeric/select inputs start in unset empty state'
    );

    const moodGroup = container.querySelector('[data-testid="metric-group-moodLevel"]')!;
    const moodSkipBtn = Array.from(moodGroup.querySelectorAll('button')).find((b) =>
      b.textContent?.trim() === 'Skip'
    );
    const moodRatingButtons = Array.from(moodGroup.querySelectorAll('button')).filter(
      (b) => b.textContent?.trim() !== 'Skip'
    );
    assert(
      moodSkipBtn?.getAttribute('aria-pressed') === 'true' &&
        moodRatingButtons.every((b) => b.getAttribute('aria-pressed') === 'false'),
      'Mood rating chips start unselected with Skip active'
    );

    const workoutGroup = container.querySelector('[data-testid="metric-group-workoutDone"]')!;
    const workoutSkipBtn = Array.from(workoutGroup.querySelectorAll('button')).find((b) =>
      b.textContent?.trim() === 'Skip'
    );
    assert(workoutSkipBtn?.getAttribute('aria-pressed') === 'true', 'Workout defaults to Skip (not false)');

    // Force-submit form while untouched -> must not save
    await act(async () => {
      saveBtn?.closest('form')?.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    });
    assert(savedCalls1.length === 0, 'Submitting untouched modal does not invoke onSaveMetric');

    // 2. Saving ONLY mood stores ONLY moodLevel (omits all other metrics)
    const happyMoodBtn = moodRatingButtons.find((b) => b.textContent?.includes('4 · Happy'))!;
    await act(async () => {
      happyMoodBtn.click();
    });

    assert(saveBtn?.disabled === false, 'Selecting mood enables Save button');
    await act(async () => {
      saveBtn?.click();
    });

    assert(savedCalls1.length === 1, 'Saving mood calls onSaveMetric once');
    const savedMoodOnly = savedCalls1[0];
    assert(savedMoodOnly.moodLevel === 4 && savedMoodOnly.date === '2026-11-16', 'Saved object stores moodLevel=4 and date');
    const omittedKeys: Array<keyof DailyLifeMetric> = [
      'sleepHours',
      'sleepQuality',
      'energyLevel',
      'stressLevel',
      'waterLitres',
      'stepsCount',
      'focusHours',
      'screenTimeHours',
      'workoutDone',
      'journalNotes',
    ];
    for (const k of omittedKeys) {
      assert(!(k in savedMoodOnly), `Unset field "${k}" is omitted from saved metric`);
    }

    // 3. Clearing a number input does NOT zero-fill; Skip keeps Save disabled again
    const savedCallsClear: DailyLifeMetric[] = [];
    await act(async () => {
      root!.render(
        React.createElement(DailyLifeCheckinModal, {
          isOpen: true,
          onClose: () => {},
          selectedDate: '2026-11-16',
          existingMetric: null,
          onSaveMetric: (m) => savedCallsClear.push(m),
        })
      );
    });
    const waterEl = document.getElementById('water-litres-input') as HTMLInputElement;
    await act(async () => {
      setReactInputValue(waterEl, '2');
    });
    assert((document.getElementById('daily-checkin-save-btn') as HTMLButtonElement).disabled === false, 'Entering water enables Save');
    await act(async () => {
      setReactInputValue(waterEl, '');
    });
    assert((document.getElementById('daily-checkin-save-btn') as HTMLButtonElement).disabled === true, 'Clearing water input sets unset (not 0) and disables Save');

    // 4. Editing existingMetric prefills and keeps untouched existing fields
    const existing: DailyLifeMetric = {
      id: 'metric-2026-11-15',
      date: '2026-11-15',
      sleepHours: 7.5,
      energyLevel: 4,
      moodLevel: 3,
      workoutDone: true,
      journalNotes: 'Steady progress',
      updatedAt: 1700000000000,
    };
    const savedEdits: DailyLifeMetric[] = [];
    await act(async () => {
      root!.render(
        React.createElement(DailyLifeCheckinModal, {
          isOpen: true,
          onClose: () => {},
          selectedDate: '2026-11-15',
          existingMetric: existing,
          onSaveMetric: (m) => savedEdits.push(m),
        })
      );
    });

    const moodGroupEdit = container.querySelector('[data-testid="metric-group-moodLevel"]')!;
    const mood5Btn = Array.from(moodGroupEdit.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('5 · Unstoppable')
    )!;
    await act(async () => {
      mood5Btn.click();
    });
    await act(async () => {
      (document.getElementById('daily-checkin-save-btn') as HTMLButtonElement).click();
    });

    assert(savedEdits.length === 1, 'Editing existing metric saves once');
    const edited = savedEdits[0];
    assert(
      edited.id === 'metric-2026-11-15' &&
        edited.date === '2026-11-15' &&
        edited.sleepHours === 7.5 &&
        edited.energyLevel === 4 &&
        edited.moodLevel === 5 &&
        edited.workoutDone === true &&
        edited.journalNotes === 'Steady progress' &&
        !('sleepQuality' in edited) &&
        !('stressLevel' in edited) &&
        !('waterLitres' in edited) &&
        !('focusHours' in edited),
      'Editing mood on existing metric updates moodLevel while keeping all other existing fields and omitting unset ones'
    );

    // 5. Analytics & Insights ignore missing fields (no NaN, no zero-filling)
    const sparseMetrics = [
      { date: '2026-11-10', mood: 5 },
      { date: '2026-11-11', sleepHours: 8 },
      { date: '2026-11-12', mood: 3, energy: 4 },
    ];
    const weekly = summarizeWeeklyMetrics(sparseMetrics);
    assert(weekly.mood === 4 && weekly.moodCount === 2, `Sparse mood averages across mood-present days only (got ${weekly.mood}, count=${weekly.moodCount})`);
    assert(weekly.sleep === 8 && weekly.sleepCount === 1, `Sparse sleep averages across sleep-present days only (got ${weekly.sleep}, count=${weekly.sleepCount})`);
    assert(weekly.energy === 4 && weekly.energyCount === 1, `Sparse energy averages across energy-present days only (got ${weekly.energy}, count=${weekly.energyCount})`);
    assert(weekly.stress === 0 && weekly.stressCount === 0 && !Number.isNaN(weekly.stress), 'Unlogged stress yields count=0 and finite non-NaN value');

    const fullSummary = buildWeeklySummary([], sparseMetrics);
    assert(
      fullSummary.averageMood === 4 && fullSummary.averageSleep === 8 && fullSummary.averageEnergy === 4,
      'buildWeeklySummary preserves non-zero-filled averages'
    );

    const moodOnlyInsights = generateInsights([], [{ date: '2026-11-10', mood: 5 }]);
    assert(
      moodOnlyInsights.some((t) => t.includes('mood trend is strong')) &&
        !moodOnlyInsights.some((t) => t.includes('Sleep is critically low')) &&
        !moodOnlyInsights.some((t) => t.includes('Energy is low')),
      'generateInsights does not emit bogus low-sleep or low-energy alerts when those metrics were skipped'
    );

    const trend = getWeeklyTrend([
      { date: '2026-11-10', mood: 2 },
      { date: '2026-11-11', sleepHours: 8 },
      { date: '2026-11-12', mood: 4 },
    ]);
    assert(trend.change === 2 && trend.trend === 'improving', `getWeeklyTrend ignores days without mood (change=${trend.change})`);

    // 6. Correlation Engine ignores missing/NaN fields (no NaN, no zero-filling)
    assert(
      calculatePearsonCorrelation([7, NaN, 8], [3, 4, 5]) === 0 &&
        calculatePearsonCorrelation([5, 5, 5], [1, 2, 3]) === 0,
      'calculatePearsonCorrelation guards against NaN and zero variance without returning NaN'
    );

    const partialDailyMetrics: DailyLifeMetric[] = [
      { id: 'm1', date: '2026-11-10', sleepHours: 6, moodLevel: 2, updatedAt: 1 },
      { id: 'm2', date: '2026-11-11', moodLevel: 5, updatedAt: 2 }, // no sleepHours
      { id: 'm3', date: '2026-11-12', sleepHours: 7, moodLevel: 3, updatedAt: 3 },
      { id: 'm4', date: '2026-11-13', sleepHours: 9, moodLevel: 5, updatedAt: 4 },
      { id: 'm5', date: '2026-11-14', waterLitres: 2, updatedAt: 5 }, // unrelated field only
    ];
    const corrResults = analyzeLifeMetricCorrelations(partialDailyMetrics, [], []);
    assert(
      corrResults.every((c) => Number.isFinite(c.coefficient)),
      'Correlation coefficients are always finite numbers (never NaN)'
    );
    const sleepMoodCorr = corrResults.find((c) => c.metricA === 'Sleep Duration' && c.metricB === 'Mood Rating');
    assert(
      sleepMoodCorr !== undefined &&
        sleepMoodCorr.sampleSize === 3 &&
        sleepMoodCorr.coefficient === 1 &&
        sleepMoodCorr.isSimulated === false,
      `Sleep vs Mood uses only the 3 paired rows (n=${sleepMoodCorr?.sampleSize}, r=${sleepMoodCorr?.coefficient}) with zero-filling ignored`
    );
  } finally {
    if (root) {
      await act(async () => {
        root!.unmount();
      });
    }
    container.innerHTML = '';
  }

  console.log('--- All DailyLifeCheckinModal & Correlation Tests Passed! ---');
}

runDailyCheckinAndCorrelationTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
