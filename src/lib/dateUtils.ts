// LifeTrack Hub - Local Calendar Date & Time Utilities

export type TimeFormat = '12h' | '24h';

const TIME_FORMAT_KEY = 'lifetrack_time_format';

/**
 * Returns YYYY-MM-DD in user's local timezone (NOT UTC).
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns YYYY-MM-DD offset by specified days relative to baseDate in user's local timezone.
 */
export function getLocalDateOffset(daysOffset: number, baseDate: Date = new Date()): string {
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + daysOffset);
  return getLocalDateString(d);
}

/**
 * Parses YYYY-MM-DD into a local Date object without UTC timezone drift.
 */
export function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return new Date();
  }
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

/**
 * Get the user's persisted time format preference ('12h' | '24h').
 */
export function getTimeFormatPreference(): TimeFormat {
  if (typeof window === 'undefined') return '12h';
  try {
    const saved = localStorage.getItem(TIME_FORMAT_KEY);
    return saved === '24h' ? '24h' : '12h';
  } catch {
    return '12h';
  }
}

/**
 * Set and persist the user's time format preference and notify subscribers.
 */
export function setTimeFormatPreference(format: TimeFormat): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TIME_FORMAT_KEY, format);
    window.dispatchEvent(new CustomEvent('lifetrack-time-format-changed', { detail: format }));
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

/**
 * Formats a 24-hour time string ("HH:mm") into 12-hour or 24-hour display format.
 */
export function formatAppTime(timeStr?: string | null, format?: TimeFormat): string {
  if (!timeStr) return '';
  const currentFormat = format || getTimeFormatPreference();

  const [hStr, mStr] = timeStr.split(':');
  const hours = parseInt(hStr, 10);
  const minutes = parseInt(mStr || '0', 10);

  if (isNaN(hours)) return timeStr;

  if (currentFormat === '24h') {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  // 12h format
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
}

/**
 * Formats local date string into readable user friendly date string.
 */
export function formatDisplayDate(dateStr: string, options?: Intl.DateTimeFormatOptions): string {
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString('en-US', options || {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
