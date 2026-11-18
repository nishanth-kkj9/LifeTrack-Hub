import { DailyLifeMetric, Task, Habit } from '../types/index.ts';

export interface CorrelationResult {
  metricA: string;
  metricB: string;
  coefficient: number; // -1.0 to +1.0
  sampleSize: number;
  insightText: string;
  relationship: 'Strong Positive' | 'Moderate Positive' | 'Neutral' | 'Moderate Negative' | 'Strong Negative';
  color: string;
  confidence?: 'low' | 'medium' | 'high';
  /**
   * HONESTY FLAG: true when the insight is a hardcoded illustrative example
   * shown before the user has enough real logged data (< 3 days). The UI must
   * render these with a visible "Sample insight" badge — never as computed fact.
   */
  isSimulated: boolean;
}

function isFiniteNum(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function getConfidenceLevel(sampleSize: number): 'low' | 'medium' | 'high' {
  if (sampleSize < 7) return 'low';
  if (sampleSize < 14) return 'medium';
  return 'high';
}

function formatCoefficient(r: number): string {
  return r > 0 ? `+${r}` : `${r}`;
}

/**
 * Calculates Pearson Correlation Coefficient r for two numeric arrays of equal length
 */
export function calculatePearsonCorrelation(x: number[], y: number[]): number {
  if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length || x.length < 3) return 0;

  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < x.length; i++) {
    if (isFiniteNum(x[i]) && isFiniteNum(y[i])) {
      xs.push(x[i]);
      ys.push(y[i]);
    }
  }

  const n = xs.length;
  if (n < 3) return 0;

  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumX2 = xs.reduce((a, b) => a + b * b, 0);
  const sumY2 = ys.reduce((a, b) => a + b * b, 0);
  const sumXY = xs.reduce((sum, xi, i) => sum + xi * ys[i], 0);

  const numerator = n * sumXY - sumX * sumY;
  const varianceProduct = (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY);
  if (!Number.isFinite(varianceProduct) || varianceProduct <= 0) return 0;

  const denominator = Math.sqrt(varianceProduct);
  if (!Number.isFinite(denominator) || denominator === 0) return 0;

  const raw = Math.max(-1, Math.min(1, numerator / denominator));
  if (!Number.isFinite(raw)) return 0;
  return Number(raw.toFixed(2)) || 0;
}

/**
 * Analyzes multi-dimensional daily life metrics against productivity and well-being
 */
export function analyzeLifeMetricCorrelations(
  metrics: DailyLifeMetric[] = [],
  _tasks: Task[] = [],
  _habits: Habit[] = []
): CorrelationResult[] {
  const activeMetrics = (metrics || []).filter((m) => m && !m.deletedAt);
  if (activeMetrics.length < 3) {
    return [];
  }

  const results: CorrelationResult[] = [];

  // Pair 1: Sleep Hours vs Mood Level
  const sleepVsMoodX: number[] = [];
  const sleepVsMoodY: number[] = [];
  activeMetrics.forEach((m) => {
    if (isFiniteNum(m.sleepHours) && isFiniteNum(m.moodLevel)) {
      sleepVsMoodX.push(m.sleepHours);
      sleepVsMoodY.push(m.moodLevel);
    }
  });

  if (sleepVsMoodX.length >= 3) {
    const n = sleepVsMoodX.length;
    const r = calculatePearsonCorrelation(sleepVsMoodX, sleepVsMoodY);
    const rStr = formatCoefficient(r);
    results.push({
      metricA: 'Sleep Duration',
      metricB: 'Mood Rating',
      coefficient: r,
      sampleSize: n,
      confidence: getConfidenceLevel(n),
      insightText:
        r >= 0.2
          ? `On the ${n} days you logged both, more sleep went with higher mood (r = ${rStr}).`
          : r <= -0.2
          ? `On the ${n} days you logged both, more sleep went with lower mood (r = ${rStr}).`
          : `On the ${n} days you logged both, sleep and mood showed little linear link (r = ${rStr}).`,
      relationship:
        r >= 0.6 ? 'Strong Positive' : r >= 0.2 ? 'Moderate Positive' : r <= -0.4 ? 'Strong Negative' : r <= -0.2 ? 'Moderate Negative' : 'Neutral',
      color: r >= 0.3 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-700 bg-slate-50 border-slate-200',
      isSimulated: false,
    });
  }

  // Pair 2: Focus Hours vs Energy Level
  const focusVsEnergyX: number[] = [];
  const focusVsEnergyY: number[] = [];
  activeMetrics.forEach((m) => {
    if (isFiniteNum(m.focusHours) && isFiniteNum(m.energyLevel)) {
      focusVsEnergyX.push(m.focusHours);
      focusVsEnergyY.push(m.energyLevel);
    }
  });

  if (focusVsEnergyX.length >= 3) {
    const n = focusVsEnergyX.length;
    const r = calculatePearsonCorrelation(focusVsEnergyX, focusVsEnergyY);
    const rStr = formatCoefficient(r);
    results.push({
      metricA: 'Focus Hours',
      metricB: 'Energy Level',
      coefficient: r,
      sampleSize: n,
      confidence: getConfidenceLevel(n),
      insightText:
        r >= 0.2
          ? `On the ${n} days you logged both, more focus time went with higher energy (r = ${rStr}).`
          : r <= -0.2
          ? `On the ${n} days you logged both, more focus time went with lower energy (r = ${rStr}).`
          : `On the ${n} days you logged both, focus time and energy showed little linear link (r = ${rStr}).`,
      relationship: r >= 0.5 ? 'Strong Positive' : r >= 0.2 ? 'Moderate Positive' : r <= -0.5 ? 'Strong Negative' : r <= -0.2 ? 'Moderate Negative' : 'Neutral',
      color: 'text-indigo-700 bg-indigo-50 border-indigo-200',
      isSimulated: false,
    });
  }

  // Pair 3: Water Intake vs Energy Level
  const waterVsEnergyX: number[] = [];
  const waterVsEnergyY: number[] = [];
  activeMetrics.forEach((m) => {
    if (isFiniteNum(m.waterLitres) && isFiniteNum(m.energyLevel)) {
      waterVsEnergyX.push(m.waterLitres);
      waterVsEnergyY.push(m.energyLevel);
    }
  });

  if (waterVsEnergyX.length >= 3) {
    const n = waterVsEnergyX.length;
    const r = calculatePearsonCorrelation(waterVsEnergyX, waterVsEnergyY);
    const rStr = formatCoefficient(r);
    results.push({
      metricA: 'Hydration (L)',
      metricB: 'Energy Level',
      coefficient: r,
      sampleSize: n,
      confidence: getConfidenceLevel(n),
      insightText:
        r >= 0.2
          ? `On the ${n} days you logged both, more water went with higher energy (r = ${rStr}).`
          : r <= -0.2
          ? `On the ${n} days you logged both, more water went with lower energy (r = ${rStr}).`
          : `On the ${n} days you logged both, water intake and energy showed little linear link (r = ${rStr}).`,
      relationship: r >= 0.4 ? 'Strong Positive' : r >= 0.2 ? 'Moderate Positive' : r <= -0.4 ? 'Strong Negative' : r <= -0.2 ? 'Moderate Negative' : 'Neutral',
      color: 'text-sky-700 bg-sky-50 border-sky-200',
      isSimulated: false,
    });
  }

  return results;
}

