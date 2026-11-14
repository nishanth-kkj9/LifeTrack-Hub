export type PomodoroMode = 'focus' | 'short_break' | 'long_break';

export interface PomodoroSettings {
  focus: number;
  short: number;
  long: number;
  longEvery: number;
  autoStart: boolean;
}

export const POMODORO_SETTINGS_STORAGE_KEY = 'lifetrack_pomodoro_settings';

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  focus: 25,
  short: 5,
  long: 15,
  longEvery: 4,
  autoStart: false,
};

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

export function sanitizePomodoroSettings(
  raw: Partial<PomodoroSettings> | null | undefined
): PomodoroSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_POMODORO_SETTINGS };
  }
  return {
    focus: clampInt(raw.focus, DEFAULT_POMODORO_SETTINGS.focus, 1, 180),
    short: clampInt(raw.short, DEFAULT_POMODORO_SETTINGS.short, 1, 60),
    long: clampInt(raw.long, DEFAULT_POMODORO_SETTINGS.long, 1, 120),
    longEvery: clampInt(raw.longEvery, DEFAULT_POMODORO_SETTINGS.longEvery, 1, 12),
    autoStart:
      typeof raw.autoStart === 'boolean' ? raw.autoStart : DEFAULT_POMODORO_SETTINGS.autoStart,
  };
}

export function loadPomodoroSettings(): PomodoroSettings {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { ...DEFAULT_POMODORO_SETTINGS };
    }
    const raw = window.localStorage.getItem(POMODORO_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_POMODORO_SETTINGS };
    }
    const parsed = JSON.parse(raw) as Partial<PomodoroSettings>;
    return sanitizePomodoroSettings(parsed);
  } catch {
    return { ...DEFAULT_POMODORO_SETTINGS };
  }
}

export function savePomodoroSettings(settings: PomodoroSettings): PomodoroSettings {
  const normalized = sanitizePomodoroSettings(settings);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(POMODORO_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
  return normalized;
}

export function getModeMinutes(mode: PomodoroMode, settings: PomodoroSettings): number {
  if (mode === 'focus') return settings.focus;
  if (mode === 'short_break') return settings.short;
  return settings.long;
}

export function getNextPomodoroTransition(
  currentMode: PomodoroMode,
  completedFocusCount: number,
  settings: PomodoroSettings
): {
  nextMode: PomodoroMode;
  nextFocusCount: number;
  shouldAutoStart: boolean;
} {
  if (currentMode === 'focus') {
    const nextFocusCount = completedFocusCount + 1;
    const every = Math.max(1, Math.round(settings.longEvery));
    const nextMode: PomodoroMode = nextFocusCount % every === 0 ? 'long_break' : 'short_break';
    return {
      nextMode,
      nextFocusCount,
      shouldAutoStart: settings.autoStart,
    };
  }

  return {
    nextMode: 'focus',
    nextFocusCount: completedFocusCount,
    shouldAutoStart: settings.autoStart,
  };
}

/**
 * Converts elapsed focus seconds into rounded minutes when `seconds >= minSeconds`.
 * Returns 0 when below threshold or rounded result is <= 0.
 */
export function computeRoundedFocusMinutes(seconds: number, minSeconds: number = 30): number {
  if (!Number.isFinite(seconds) || seconds < minSeconds) {
    return 0;
  }
  return Math.round(seconds / 60);
}
