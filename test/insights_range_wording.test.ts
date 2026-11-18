import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import {
  filterMetricsByRange,
  buildWeeklySummary,
  generateInsights,
} from '../src/lib/analytics.ts';
import type { DailyLifeMetric } from '../src/types/index.ts';
import { getLocalDateOffset, getLocalDateString } from '../src/lib/dateUtils.ts';

const dom = new JSDOM(
  '<!DOCTYPE html><html><head><title>Insights Range & Wording Test</title></head><body><div id="root"></div></body></html>',
  {
    url: 'http://localhost:3000',
    pretendToBeVisual: true,
  }
);

Object.defineProperty(globalThis, 'window', { value: dom.window, writable: true, configurable: true });
Object.defineProperty(globalThis, 'document', { value: dom.window.document, writable: true, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
Object.defineProperty(globalThis, 'HTMLElement', { value: dom.window.HTMLElement, writable: true, configurable: true });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runInsightsRangeWordingTests() {
  console.log('--- Starting Insights Range Filter, Wording & Tiles Tests ---');

  // 1. filterMetricsByRange unit tests (boundaries, today, future, month edge, deleted)
  const metricsFixture: DailyLifeMetric[] = [
    { id: 'm-old-year', date: '2025-10-01', moodLevel: 4, updatedAt: 1 },
    { id: 'm-before-30', date: '2026-10-19', moodLevel: 4, updatedAt: 2 },
    { id: 'm-start-30', date: '2026-10-20', moodLevel: 4, updatedAt: 3 },
    { id: 'm-before-7', date: '2026-11-11', moodLevel: 3, updatedAt: 4 },
    { id: 'm-start-7', date: '2026-11-12', moodLevel: 5, updatedAt: 5 },
    { id: 'm-deleted', date: '2026-11-17', moodLevel: 1, updatedAt: 6, deletedAt: 999 },
    { id: 'm-today', date: '2026-11-18', moodLevel: 4, updatedAt: 7 },
    { id: 'm-future', date: '2026-11-19', moodLevel: 5, updatedAt: 8 },
  ];

  const r7 = filterMetricsByRange(metricsFixture, 7, '2026-11-18');
  assert(
    JSON.stringify(r7.map((m) => m.id)) === JSON.stringify(['m-start-7', 'm-today']),
    'filterMetricsByRange(..., 7, today) includes start-of-7 and today, excludes day-8, future, and deleted'
  );

  const r30 = filterMetricsByRange(metricsFixture, 30, '2026-11-18');
  assert(
    JSON.stringify(r30.map((m) => m.id)) ===
      JSON.stringify(['m-start-30', 'm-before-7', 'm-start-7', 'm-today']),
    'filterMetricsByRange(..., 30, today) includes exact 30-day window inclusive of today and excludes day-31 and deleted'
  );

  const rAll = filterMetricsByRange(metricsFixture, null, '2026-11-18');
  assert(
    rAll.length === 7 && !rAll.some((m) => m.id === 'm-deleted'),
    'filterMetricsByRange(..., null) returns all active metrics across all dates and ignores tombstones'
  );

  const monthBoundary = filterMetricsByRange(
    [
      { id: 'b1', date: '2026-02-24', moodLevel: 3, updatedAt: 1 },
      { id: 'b2', date: '2026-02-25', moodLevel: 4, updatedAt: 2 },
      { id: 'b3', date: '2026-03-03', moodLevel: 5, updatedAt: 3 },
    ],
    7,
    '2026-03-03'
  );
  assert(
    JSON.stringify(monthBoundary.map((m) => m.id)) === JSON.stringify(['b2', 'b3']),
    'filterMetricsByRange handles month boundaries cleanly in local calendar dates'
  );

  // 2. buildWeeklySummary range wording & backward compatibility without range
  const defaultSummary = buildWeeklySummary([], r7);
  assert(
    defaultSummary.weeklyHighlights[0] === 'You tracked 2 of the last 7 days.',
    'buildWeeklySummary defaults to "You tracked N of the last 7 days."'
  );

  const thirtySummary = buildWeeklySummary([], r30, 30);
  assert(
    thirtySummary.weeklyHighlights[0] === 'You tracked 4 of the last 30 days.',
    'buildWeeklySummary with rangeDays=30 outputs "You tracked N of the last 30 days."'
  );

  const allSummary = buildWeeklySummary([], rAll, null);
  assert(
    allSummary.weeklyHighlights[0] === 'You tracked 7 days across all time.',
    'buildWeeklySummary with rangeDays=null outputs "You tracked N days across all time."'
  );

  // 3. generateInsights mood wording & exact-3 no-warning rules
  const stableMood3 = generateInsights([], [
    { date: '2026-11-12', mood: 3 },
    { date: '2026-11-13', mood: 3 },
    { date: '2026-11-14', mood: 3 },
  ]);
  assert(
    stableMood3.some((t) => t === 'Average mood is 3/5.') &&
      stableMood3.every((t) => !t.includes('trending lower') && !t.includes('⚠️') && !t.includes('🔴')),
    'Mood average of exactly 3 (stable) gets "Average mood is 3/5." and no warning'
  );

  const improvingMood25 = generateInsights([], [
    { date: '2026-11-12', mood: 2 },
    { date: '2026-11-13', mood: 3 },
  ]);
  assert(
    improvingMood25.some((t) => t === 'Average mood is 2.5/5.') &&
      improvingMood25.every((t) => !t.includes('trending lower')),
    'Improving mood averaging 2.5 does NOT say "trending lower" and says "Average mood is 2.5/5."'
  );

  const decliningMood25 = generateInsights([], [
    { date: '2026-11-10', mood: 4 },
    { date: '2026-11-11', mood: 4 },
    { date: '2026-11-12', mood: 1 },
    { date: '2026-11-13', mood: 1 },
  ]);
  assert(
    decliningMood25.some((t) => t.includes('trending lower')),
    'Declining mood from getWeeklyTrend uses "trending lower"'
  );

  const decliningMood3 = generateInsights([], [
    { date: '2026-11-10', mood: 5 },
    { date: '2026-11-11', mood: 1 },
  ]);
  assert(
    decliningMood3.every((t) => !t.includes('⚠️') && !t.includes('🔴')),
    'Mood average of exactly 3 never emits a warning icon/alert even when split'
  );

  // 4. UI Tests in InsightsView (segmented control, tiles, sub-labels, min-30-day correlation window)
  const { InsightsView } = await import('../src/components/views/InsightsView.tsx');
  const today = new Date();
  const todayStr = getLocalDateString(today);
  // 2 entries within last 7 days, 2 more entries 15-20 days ago (so 4 entries inside 30 days), 1 entry 60 days ago
  const uiMetrics: DailyLifeMetric[] = [
    { id: 'u1', date: todayStr, sleepHours: 8, moodLevel: 5, updatedAt: 5 },
    { id: 'u2', date: getLocalDateOffset(-2, today), sleepHours: 7, moodLevel: 4, updatedAt: 4 },
    { id: 'u3', date: getLocalDateOffset(-15, today), sleepHours: 6, moodLevel: 3, updatedAt: 3 },
    { id: 'u4', date: getLocalDateOffset(-20, today), sleepHours: 5, moodLevel: 2, updatedAt: 2 },
    { id: 'u5', date: getLocalDateOffset(-60, today), sleepHours: 4, moodLevel: 1, updatedAt: 1 },
  ];

  const container = document.getElementById('root')!;
  const root: Root = createRoot(container);

  await act(async () => {
    root.render(
      React.createElement(InsightsView, {
        tasks: [],
        habits: [],
        transactions: [],
        budget: { monthlyBudget: 0, savingsGoal: 0 },
        exams: [],
        dailyMetrics: uiMetrics,
        onSaveDailyMetric: () => {},
      })
    );
  });

  const btn7 = document.getElementById('insights-range-7');
  const btn30 = document.getElementById('insights-range-30');
  const btnAll = document.getElementById('insights-range-all');
  assert(
    btn7?.getAttribute('aria-pressed') === 'true' &&
      btn30?.getAttribute('aria-pressed') === 'false' &&
      btnAll?.getAttribute('aria-pressed') === 'false',
    'InsightsView defaults to 7 days selected in segmented control'
  );

  const text7 = container.textContent || '';
  assert(
    text7.includes('You tracked 2 of the last 7 days.') &&
      text7.includes('7-day avg') &&
      text7.includes('Done this period') &&
      text7.includes('Habit strength') &&
      text7.includes('4 days'), // Correlations use 30 days even when 7 days is selected!
    '7-day view renders "You tracked 2 of the last 7 days.", "7-day avg", separate Done/Strength tiles, and >=30d correlations'
  );

  await act(async () => {
    btn30?.click();
  });
  const text30 = container.textContent || '';
  assert(
    btn30?.getAttribute('aria-pressed') === 'true' &&
      text30.includes('You tracked 4 of the last 30 days.') &&
      text30.includes('30-day avg'),
    'Switching to 30 days updates tracking wording and card sub-labels to "30-day avg"'
  );

  await act(async () => {
    btnAll?.click();
  });
  const textAll = container.textContent || '';
  assert(
    btnAll?.getAttribute('aria-pressed') === 'true' &&
      textAll.includes('You tracked 5 days across all time.') &&
      textAll.includes('All-time avg') &&
      textAll.includes('5 days'),
    'Switching to All time updates tracking wording, "All-time avg" sub-labels, and correlations window'
  );

  await act(async () => {
    root.unmount();
  });

  console.log('--- All Insights Range Filter, Wording & Tiles Tests Passed! ---');
}

await runInsightsRangeWordingTests();
