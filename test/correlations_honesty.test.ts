import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { analyzeLifeMetricCorrelations, calculatePearsonCorrelation } from '../src/lib/correlationEngine.ts';
import type { DailyLifeMetric } from '../src/types/index.ts';

const dom = new JSDOM(
  '<!DOCTYPE html><html><head><title>Correlations Honesty Test</title></head><body><div id="root"></div></body></html>',
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
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

function makeMetric(idx: number, overrides: Partial<DailyLifeMetric>): DailyLifeMetric {
  const day = String(idx + 1).padStart(2, '0');
  return {
    id: `m-${idx}`,
    date: `2026-11-${day}`,
    updatedAt: 1700000000000 + idx * 86_400_000,
    ...overrides,
  };
}

async function runCorrelationsHonestyTests() {
  console.log('--- Starting Correlation Honesty, Confidence & Empty-State Tests ---');

  // 1. 0 and 2 metrics -> []
  assert(
    JSON.stringify(analyzeLifeMetricCorrelations([], [], [])) === '[]',
    '0 metrics returns empty [] (no simulated results)'
  );

  const twoMetrics: DailyLifeMetric[] = [
    makeMetric(0, { sleepHours: 7, moodLevel: 4 }),
    makeMetric(1, { sleepHours: 8, moodLevel: 5 }),
  ];
  assert(
    JSON.stringify(analyzeLifeMetricCorrelations(twoMetrics, [], [])) === '[]',
    '2 metrics returns empty [] (no simulated results)'
  );

  // 2. 4 active metrics where no pair has >= 3 co-logged days -> []
  const disjointPairs: DailyLifeMetric[] = [
    makeMetric(0, { sleepHours: 7, moodLevel: 4 }),
    makeMetric(1, { sleepHours: 8, moodLevel: 5 }),
    makeMetric(2, { focusHours: 3, energyLevel: 4 }),
    makeMetric(3, { waterLitres: 2.5, energyLevel: 5 }),
  ];
  assert(
    JSON.stringify(analyzeLifeMetricCorrelations(disjointPairs, [], [])) === '[]',
    '4 metrics with <3 paired samples per pair returns empty []'
  );

  // 3. 5 metrics with a known r -> 1 result with confidence='low', sampleSize=5, plain wording
  const sleepXs = [5, 6, 7, 8, 9];
  const moodYs = [2, 3, 3, 4, 5];
  const expectedR = calculatePearsonCorrelation(sleepXs, moodYs);
  const fiveMetrics = sleepXs.map((s, idx) =>
    makeMetric(idx, { sleepHours: s, moodLevel: moodYs[idx] })
  );
  const fiveResults = analyzeLifeMetricCorrelations(fiveMetrics, [], []);
  assert(
    fiveResults.length === 1 &&
      fiveResults[0].coefficient === expectedR &&
      fiveResults[0].sampleSize === 5 &&
      fiveResults[0].confidence === 'low' &&
      fiveResults[0].isSimulated === false &&
      fiveResults[0].insightText.includes('5 days') &&
      fiveResults[0].insightText.includes(`r = +${expectedR}`),
    `5 metrics with known r=+${expectedR} produces 1 real result with confidence='low' and n=5`
  );

  // 4. Confidence medium (7-13) and high (>=14), plus tombstone exclusion
  const sevenMetrics = Array.from({ length: 7 }, (_, i) =>
    makeMetric(i, { sleepHours: 5 + i * 0.5, moodLevel: Math.min(5, 1 + Math.floor(i / 2)) })
  );
  const sevenPlusTombstone = [
    ...sevenMetrics,
    makeMetric(99, { sleepHours: 1, moodLevel: 5, deletedAt: 1700099999999 }),
  ];
  const medResults = analyzeLifeMetricCorrelations(sevenPlusTombstone, [], []);
  assert(
    medResults.length === 1 && medResults[0].sampleSize === 7 && medResults[0].confidence === 'medium',
    '7 active metrics (+1 tombstoned) gives sampleSize=7 and confidence="medium"'
  );

  const fourteenMetrics = Array.from({ length: 14 }, (_, i) =>
    makeMetric(i, { sleepHours: 5 + (i % 4), moodLevel: 2 + (i % 3) })
  );
  const highResults = analyzeLifeMetricCorrelations(fourteenMetrics, [], []);
  assert(
    highResults.length === 1 && highResults[0].sampleSize === 14 && highResults[0].confidence === 'high',
    '14 metrics gives sampleSize=14 and confidence="high"'
  );

  // 5. UI Tests in InsightsView
  const { InsightsView } = await import('../src/components/views/InsightsView.tsx');
  const container = document.getElementById('root')!;
  const root: Root = createRoot(container);

  // 5a. Empty dailyMetrics -> no "r = +0.74", empty state prompt + button opens check-in modal
  await act(async () => {
    root.render(
      React.createElement(InsightsView, {
        tasks: [],
        habits: [],
        transactions: [],
        budget: { monthlyBudget: 0, savingsGoal: 0 },
        exams: [],
        dailyMetrics: [],
        onSaveDailyMetric: () => {},
      })
    );
  });

  const emptyText = container.textContent || '';
  assert(
    !emptyText.includes('r = +0.74') &&
      !emptyText.includes('0.74') &&
      emptyText.includes(
        'Log at least 3 days of sleep + mood (or focus/energy, water/energy) to see correlations'
      ),
    'Seeded empty data in InsightsView renders empty state and never shows "r = +0.74"'
  );

  const emptyBtn = document.getElementById('correlations-empty-checkin-btn') as HTMLButtonElement | null;
  assert(emptyBtn !== null, 'Empty correlations state renders check-in button');
  await act(async () => {
    emptyBtn?.click();
  });
  assert(
    document.querySelector('[role="dialog"][aria-labelledby="daily-checkin-modal-title"]') !== null,
    'Clicking empty state check-in button opens existing DailyLifeCheckinModal'
  );

  // Close modal
  await act(async () => {
    (document.querySelector('button[aria-label="Close modal"]') as HTMLButtonElement | null)?.click();
  });

  // 5b. Real 5 metrics in InsightsView -> shows "5 days", "Low confidence", "Correlation does not prove cause."
  await act(async () => {
    root.render(
      React.createElement(InsightsView, {
        tasks: [],
        habits: [],
        transactions: [],
        budget: { monthlyBudget: 0, savingsGoal: 0 },
        exams: [],
        dailyMetrics: fiveMetrics,
        onSaveDailyMetric: () => {},
      })
    );
  });

  const realText = container.textContent || '';
  assert(
    realText.includes('5 days') &&
      realText.includes('Low confidence') &&
      realText.includes('Correlation does not prove cause.') &&
      !realText.includes('Sample insight') &&
      !realText.includes('r = +0.74'),
    'InsightsView with 5 real metrics shows "5 days", text confidence label, causality note, and no Sample insight badge'
  );

  await act(async () => {
    root.unmount();
  });

  console.log('--- All Correlation Honesty, Confidence & Empty-State Tests Passed! ---');
}

await runCorrelationsHonestyTests();
