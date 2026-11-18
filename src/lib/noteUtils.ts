import { QuickNote } from '../types/index.ts';

export const safeNoteText = (val: unknown): string =>
  typeof val === 'string' ? val : String(val ?? '');

export const safeNoteCategory = (val: unknown): string =>
  typeof val === 'string' && val.trim().length > 0 ? val : 'General';

export const safeNoteTimestamp = (val: unknown): number =>
  typeof val === 'number' && Number.isFinite(val) ? val : 0;

export function getNoteDisplayTimestamp(note: QuickNote): number {
  if (typeof note.contentUpdatedAt === 'number' && Number.isFinite(note.contentUpdatedAt)) {
    return note.contentUpdatedAt;
  }
  return safeNoteTimestamp(note.updatedAt);
}

export function formatNoteRelativeTime(timestamp: unknown, now: number = Date.now()): string {
  const ts = safeNoteTimestamp(timestamp);
  if (!ts || ts <= 0) return '';

  const diffSeconds = Math.round((ts - now) / 1000);
  const absSeconds = Math.abs(diffSeconds);
  const locale =
    typeof navigator !== 'undefined' && navigator.language ? navigator.language : undefined;

  if (typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat === 'function') {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (absSeconds < 60) {
      return rtf.format(diffSeconds === 0 ? 0 : diffSeconds, 'second');
    }
    const diffMinutes = Math.round(diffSeconds / 60);
    if (Math.abs(diffMinutes) < 60) {
      return rtf.format(diffMinutes, 'minute');
    }
    const diffHours = Math.round(diffMinutes / 60);
    if (Math.abs(diffHours) < 24) {
      return rtf.format(diffHours, 'hour');
    }
    const diffDays = Math.round(diffHours / 24);
    if (Math.abs(diffDays) < 7) {
      return rtf.format(diffDays, 'day');
    }
    if (Math.abs(diffDays) < 30) {
      return rtf.format(Math.round(diffDays / 7), 'week');
    }
    if (Math.abs(diffDays) < 365) {
      return rtf.format(Math.round(diffDays / 30), 'month');
    }
    return rtf.format(Math.round(diffDays / 365), 'year');
  }

  return new Date(ts).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

export function countNoteWords(str: unknown): number {
  const text = safeNoteText(str).trim();
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}
