import {
  RecurringTransaction,
  Transaction,
  FinanceCategory,
  FinancePaymentMethod,
} from '../types/index.ts';
import { getLocalDateOffset, getLocalDateString, parseLocalDate } from './dateUtils.ts';
import { isActive, touch } from './entity.ts';

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarYmd(ymd: string | undefined): ymd is string {
  if (!ymd || !YMD_RE.test(ymd)) return false;
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function formatYmdParts(year: number, monthIndex0: number, day: number): string {
  return `${year}-${String(monthIndex0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Resolves a monthly target day (1..31) in the specified year/month,
 * clamping to the last day of that month (e.g. 31 -> 28/29 in Feb, 30 in Apr).
 */
export function clampMonthlyDate(
  year: number,
  monthIndex0: number,
  dayOfMonth: number
): string {
  const safeDay = Math.min(31, Math.max(1, Math.trunc(dayOfMonth)));
  const maxDay = daysInMonth(year, monthIndex0);
  return formatYmdParts(year, monthIndex0, Math.min(safeDay, maxDay));
}

/**
 * Enumerates all YYYY-MM-DD occurrence dates for a recurring schedule
 * within [minDate, maxDate] inclusive, respecting `startDate`, optional `endDate`,
 * and month-end clamping for monthly dayOfMonth (e.g. day 31).
 */
export function enumerateRecurringOccurrences(
  schedule: RecurringTransaction,
  maxDate: string,
  afterDateExclusive?: string
): string[] {
  if (!isActive(schedule)) return [];
  if (!isValidCalendarYmd(schedule.startDate) || !isValidCalendarYmd(maxDate)) return [];

  const effectiveEnd =
    schedule.endDate && isValidCalendarYmd(schedule.endDate) && schedule.endDate < maxDate
      ? schedule.endDate
      : maxDate;

  if (effectiveEnd < schedule.startDate) return [];

  const results: string[] = [];

  if (schedule.frequency === 'weekly') {
    const startDt = parseLocalDate(schedule.startDate);
    let step = 0;
    while (step < 10000) {
      const candidate = getLocalDateOffset(step * 7, startDt);
      if (candidate > effectiveEnd) break;
      if (
        candidate >= schedule.startDate &&
        (!afterDateExclusive || candidate > afterDateExclusive)
      ) {
        results.push(candidate);
      }
      step++;
    }
    return results;
  }

  if (schedule.frequency === 'monthly') {
    const [startYear, startMonth1, startDay] = schedule.startDate.split('-').map(Number);
    const baseMonth0 = startMonth1 - 1;
    const anchorDay =
      typeof schedule.dayOfMonth === 'number' &&
      Number.isInteger(schedule.dayOfMonth) &&
      schedule.dayOfMonth >= 1 &&
      schedule.dayOfMonth <= 31
        ? schedule.dayOfMonth
        : startDay;

    let monthOffset = 0;
    while (monthOffset < 1200) {
      const totalMonths = baseMonth0 + monthOffset;
      const year = startYear + Math.floor(totalMonths / 12);
      const month0 = totalMonths % 12;
      const candidate = clampMonthlyDate(year, month0, anchorDay);
      if (candidate > effectiveEnd) break;
      if (
        candidate >= schedule.startDate &&
        (!afterDateExclusive || candidate > afterDateExclusive)
      ) {
        results.push(candidate);
      }
      monthOffset++;
    }
    return results;
  }

  return results;
}

export interface RecurringGenerationResult {
  transactions: Transaction[];
  recurringTransactions: RecurringTransaction[];
  generated: Transaction[];
  changed: boolean;
}

/**
 * Idempotently generates missing past/current normal transactions for active recurring schedules.
 * - Uses `lastGeneratedOn` AND deterministic IDs (`rec-${schedule.id}-${occDate}`) so duplicates
 *   are never created even across repeated invocations or deleted occurrences.
 * - Respects `endDate` (never generates past `endDate`).
 * - Applies month-end clamping for monthly schedules (e.g. day 31 -> Feb 28/29).
 */
export function generateMissingRecurringTransactions(
  data: {
    transactions: Transaction[];
    recurringTransactions?: RecurringTransaction[];
  },
  todayStr: string = getLocalDateString(),
  now: number = Date.now()
): RecurringGenerationResult {
  const existingTransactions = Array.isArray(data.transactions) ? data.transactions : [];
  const existingSchedules = Array.isArray(data.recurringTransactions)
    ? data.recurringTransactions
    : [];

  if (existingSchedules.length === 0 || !isValidCalendarYmd(todayStr)) {
    return {
      transactions: existingTransactions,
      recurringTransactions: existingSchedules,
      generated: [],
      changed: false,
    };
  }

  const seenTxIds = new Set<string>(existingTransactions.map((t) => t.id));
  const generated: Transaction[] = [];
  let schedulesChanged = false;

  const nextSchedules = existingSchedules.map((schedule) => {
    if (!isActive(schedule)) return schedule;
    if (
      typeof schedule.amount !== 'number' ||
      !Number.isFinite(schedule.amount) ||
      schedule.amount <= 0
    ) {
      return schedule;
    }

    const lastGen = isValidCalendarYmd(schedule.lastGeneratedOn)
      ? schedule.lastGeneratedOn
      : undefined;
    const dueDates = enumerateRecurringOccurrences(schedule, todayStr, lastGen);
    if (dueDates.length === 0) {
      return schedule;
    }

    let latestProcessedDate = lastGen;
    for (const occDate of dueDates) {
      const txId = `rec-${schedule.id}-${occDate}`;
      if (!seenTxIds.has(txId)) {
        seenTxIds.add(txId);
        generated.push({
          id: txId,
          title: schedule.title,
          amount: schedule.amount,
          type: schedule.type,
          category: (schedule.category || 'Other') as FinanceCategory,
          date: occDate,
          paymentMethod: (schedule.paymentMethod || 'Other') as FinancePaymentMethod,
          notes: `Recurring (${schedule.frequency})`,
          createdAt: now,
          updatedAt: now,
        });
      }
      if (!latestProcessedDate || occDate > latestProcessedDate) {
        latestProcessedDate = occDate;
      }
    }

    if (latestProcessedDate && latestProcessedDate !== schedule.lastGeneratedOn) {
      schedulesChanged = true;
      return touch(
        {
          ...schedule,
          lastGeneratedOn: latestProcessedDate,
        },
        now
      );
    }
    return schedule;
  });

  const changed = generated.length > 0 || schedulesChanged;
  if (!changed) {
    return {
      transactions: existingTransactions,
      recurringTransactions: existingSchedules,
      generated: [],
      changed: false,
    };
  }

  return {
    transactions: [...[...generated].reverse(), ...existingTransactions],
    recurringTransactions: nextSchedules,
    generated,
    changed: true,
  };
}

export interface UpcomingBillItem {
  key: string;
  scheduleId: string;
  title: string;
  amount: number;
  category: FinanceCategory;
  paymentMethod: FinancePaymentMethod;
  frequency: RecurringTransaction['frequency'];
  date: string; // YYYY-MM-DD
}

/**
 * Returns upcoming recurring expense bills strictly after `todayStr` and within
 * the next `windowDays` days (inclusive), sorted chronologically.
 */
export function getUpcomingBills(
  recurringTransactions: RecurringTransaction[] | undefined,
  todayStr: string = getLocalDateString(),
  windowDays: number = 30
): UpcomingBillItem[] {
  if (!Array.isArray(recurringTransactions) || recurringTransactions.length === 0) {
    return [];
  }
  if (!isValidCalendarYmd(todayStr) || windowDays < 1) {
    return [];
  }

  const windowEnd = getLocalDateOffset(windowDays, parseLocalDate(todayStr));
  const items: UpcomingBillItem[] = [];

  for (const schedule of recurringTransactions) {
    if (!isActive(schedule)) continue;
    if (schedule.type !== 'expense') continue;
    const dates = enumerateRecurringOccurrences(schedule, windowEnd, todayStr);
    for (const date of dates) {
      items.push({
        key: `${schedule.id}-${date}`,
        scheduleId: schedule.id,
        title: schedule.title,
        amount: schedule.amount,
        category: schedule.category,
        paymentMethod: schedule.paymentMethod,
        frequency: schedule.frequency,
        date,
      });
    }
  }

  return items.sort((a, b) => {
    const dDiff = a.date.localeCompare(b.date);
    if (dDiff !== 0) return dDiff;
    return a.title.localeCompare(b.title);
  });
}
