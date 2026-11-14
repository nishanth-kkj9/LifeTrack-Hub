import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Headphones,
  Check,
  Target,
  SlidersHorizontal,
} from 'lucide-react';
import { Task } from '../../types/index.ts';
import {
  playFocusBellSound,
  playTaskCompleteSound,
  focusSoundEngine,
  triggerTaskConfetti,
} from '../../lib/todoUtils.ts';
import { useModalFocus } from '../../hooks/useModalFocus.ts';
import { completeTask } from '../../lib/taskActions.ts';
import {
  PomodoroMode,
  PomodoroSettings,
  DEFAULT_POMODORO_SETTINGS,
  loadPomodoroSettings,
  savePomodoroSettings,
  getModeMinutes,
  getNextPomodoroTransition,
  computeRoundedFocusMinutes,
} from '../../lib/pomodoroUtils.ts';

interface PomodoroFocusModalProps {
  task: Task | null;
  tasks?: Task[];
  isOpen: boolean;
  onClose: () => void;
  onUpdateTask: (task: Task, nextTask?: Task) => void;
  onAddFocusMinutes?: (taskId: string, minutes: number) => void;
}

export const PomodoroFocusModal: React.FC<PomodoroFocusModalProps> = ({
  task,
  tasks,
  isOpen,
  onClose,
  onUpdateTask,
  onAddFocusMinutes,
}) => {
  // Resolve the latest task from props via id to avoid stale overwrites
  const latestTask = useMemo(() => {
    if (!task) return null;
    if (tasks && tasks.length > 0) {
      return tasks.find((t) => t.id === task.id) ?? task;
    }
    return task;
  }, [task, tasks]);

  const [settings, setSettings] = useState<PomodoroSettings>(() => loadPomodoroSettings());
  const [showSettings, setShowSettings] = useState(false);
  const [timerMode, setTimerMode] = useState<PomodoroMode>('focus');
  const [timeLeft, setTimeLeft] = useState(() => loadPomodoroSettings().focus * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [completedFocusCount, setCompletedFocusCount] = useState(0);
  const [soundType, setSoundType] = useState<'off' | 'binaural40' | 'rain' | 'stream' | 'whitenoise'>('binaural40');
  const [soundVolume, setSoundVolume] = useState(0.2);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sessionCompletedSeconds, setSessionCompletedSeconds] = useState(0);
  const [customGoal, setCustomGoal] = useState('');

  const accumulatedFocusSecondsRef = useRef(0);
  const targetEndTimeRef = useRef<number | null>(null);
  const lastSyncMsRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refs for reading latest props/state inside stable callbacks and intervals
  const latestTaskRef = useRef<Task | null>(latestTask);
  latestTaskRef.current = latestTask;
  const settingsRef = useRef<PomodoroSettings>(settings);
  settingsRef.current = settings;
  const timerModeRef = useRef<PomodoroMode>(timerMode);
  timerModeRef.current = timerMode;
  const completedFocusCountRef = useRef<number>(completedFocusCount);
  completedFocusCountRef.current = completedFocusCount;
  const onAddFocusMinutesRef = useRef(onAddFocusMinutes);
  onAddFocusMinutesRef.current = onAddFocusMinutes;
  const onUpdateTaskRef = useRef(onUpdateTask);
  onUpdateTaskRef.current = onUpdateTask;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const syncWallClock = useCallback(() => {
    if (!targetEndTimeRef.current) return;
    const now = Date.now();
    const effectiveNow = Math.min(now, targetEndTimeRef.current);

    if (lastSyncMsRef.current !== null) {
      const deltaSecs = Math.max(0, Math.floor((effectiveNow - lastSyncMsRef.current) / 1000));
      if (deltaSecs > 0) {
        lastSyncMsRef.current += deltaSecs * 1000;
        if (timerModeRef.current === 'focus') {
          accumulatedFocusSecondsRef.current += deltaSecs;
          setSessionCompletedSeconds((s) => s + deltaSecs);
        }
      }
    }

    const remaining = Math.max(0, Math.ceil((targetEndTimeRef.current - now) / 1000));
    setTimeLeft(remaining);
  }, []);

  // Single unified path to persist focus minutes via onAddFocusMinutes
  const commitFocusMinutes = useCallback((minSeconds: number) => {
    const currentTask = latestTaskRef.current;
    if (!currentTask) return;
    const minutes = computeRoundedFocusMinutes(accumulatedFocusSecondsRef.current, minSeconds);
    if (minutes <= 0) return;

    if (onAddFocusMinutesRef.current) {
      onAddFocusMinutesRef.current(currentTask.id, minutes);
    } else {
      onUpdateTaskRef.current({
        ...currentTask,
        actualMinutes: (currentTask.actualMinutes || 0) + minutes,
      });
    }
    accumulatedFocusSecondsRef.current = 0;
  }, []);

  const handleClose = useCallback(() => {
    syncWallClock();
    focusSoundEngine.stop();
    // On close, save rounded minutes if at least 30 seconds of focus elapsed
    commitFocusMinutes(30);
    onCloseRef.current();
  }, [syncWallClock, commitFocusMinutes]);

  const { containerRef } = useModalFocus<HTMLDivElement>({
    isOpen,
    onClose: handleClose,
  });

  const switchMode = useCallback((nextMode: PomodoroMode, autoRun: boolean) => {
    targetEndTimeRef.current = null;
    lastSyncMsRef.current = null;
    timerModeRef.current = nextMode;
    setTimerMode(nextMode);
    setTimeLeft(getModeMinutes(nextMode, settingsRef.current) * 60);
    setIsRunning(autoRun);
  }, []);

  // Reset session accounting when modal opens or active task changes
  useEffect(() => {
    if (isOpen) {
      const loaded = loadPomodoroSettings();
      setSettings(loaded);
      settingsRef.current = loaded;
      accumulatedFocusSecondsRef.current = 0;
      targetEndTimeRef.current = null;
      lastSyncMsRef.current = null;
      completedFocusCountRef.current = 0;
      setCompletedFocusCount(0);
      setSessionCompletedSeconds(0);
      setShowSettings(false);
      timerModeRef.current = 'focus';
      setTimerMode('focus');
      setTimeLeft(loaded.focus * 60);
      setIsRunning(false);
    }
  }, [isOpen, task?.id]);

  // Handle ambient sound engine
  useEffect(() => {
    if (!isOpen || !isRunning || soundType === 'off') {
      focusSoundEngine.stop();
    } else {
      focusSoundEngine.start(soundType, soundVolume);
    }

    return () => {
      focusSoundEngine.stop();
    };
  }, [isOpen, isRunning, soundType]);

  // Update volume
  useEffect(() => {
    focusSoundEngine.setVolume(soundVolume);
  }, [soundVolume]);

  // Wall-clock synchronized countdown loop + tab visibility catch-up
  useEffect(() => {
    if (!isOpen) return;

    if (isRunning) {
      const now = Date.now();
      targetEndTimeRef.current = now + timeLeft * 1000;
      lastSyncMsRef.current = now;

      timerRef.current = setInterval(syncWallClock, 500);
      const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
          syncWallClock();
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    } else {
      syncWallClock();
      targetEndTimeRef.current = null;
      lastSyncMsRef.current = null;
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, isRunning, timerMode, syncWallClock]);

  const handleTimerComplete = useCallback(() => {
    playFocusBellSound();
    triggerTaskConfetti();

    const activeMode = timerModeRef.current;
    if (activeMode === 'focus') {
      commitFocusMinutes(30);
    }

    const transition = getNextPomodoroTransition(
      activeMode,
      completedFocusCountRef.current,
      settingsRef.current
    );
    completedFocusCountRef.current = transition.nextFocusCount;
    setCompletedFocusCount(transition.nextFocusCount);
    switchMode(transition.nextMode, transition.shouldAutoStart);
  }, [commitFocusMinutes, switchMode]);

  // Completion effect when countdown reaches 0
  useEffect(() => {
    if (isOpen && timeLeft === 0 && isRunning) {
      syncWallClock();
      targetEndTimeRef.current = null;
      lastSyncMsRef.current = null;
      if (timerRef.current) clearInterval(timerRef.current);
      handleTimerComplete();
    }
  }, [isOpen, timeLeft, isRunning, syncWallClock, handleTimerComplete]);

  if (!isOpen) return null;

  const updateSettings = (patch: Partial<PomodoroSettings>) => {
    const prev = settingsRef.current;
    const next = savePomodoroSettings({ ...prev, ...patch });
    settingsRef.current = next;
    setSettings(next);

    if (!isRunning) {
      const prevModeSecs = getModeMinutes(timerMode, prev) * 60;
      const nextModeSecs = getModeMinutes(timerMode, next) * 60;
      if (prevModeSecs !== nextModeSecs && (timeLeft === prevModeSecs || sessionCompletedSeconds === 0)) {
        setTimeLeft(nextModeSecs);
      }
    }
  };

  const toggleTimer = () => {
    setIsRunning((prev) => !prev);
  };

  const handleReset = () => {
    setIsRunning(false);
    targetEndTimeRef.current = null;
    lastSyncMsRef.current = null;
    accumulatedFocusSecondsRef.current = 0;
    setSessionCompletedSeconds(0);
    setTimeLeft(getModeMinutes(timerMode, settings) * 60);
  };

  const handleToggleSubtask = (subtaskId: string) => {
    const currentTask = latestTaskRef.current;
    if (!currentTask) return;
    const updatedSubtasks = currentTask.subtasks.map((s) =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    const allDone = updatedSubtasks.length > 0 && updatedSubtasks.every((s) => s.completed);
    if (!currentTask.subtasks.find((s) => s.id === subtaskId)?.completed) {
      playTaskCompleteSound();
    }
    const nextBase: Task = {
      ...currentTask,
      subtasks: updatedSubtasks,
    };
    if (allDone && !currentTask.completed) {
      const { completed, nextTask } = completeTask(nextBase);
      onUpdateTask(completed, nextTask);
    } else {
      onUpdateTask(nextBase);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const totalModeDuration = Math.max(1, getModeMinutes(timerMode, settings) * 60);
  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round(((totalModeDuration - timeLeft) / totalModeDuration) * 100))
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pomodoro focus timer"
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md transition-all p-4 ${
        isFullscreen ? 'p-0' : 'p-4'
      }`}
    >
      <div
        ref={containerRef}
        className={`bg-slate-900 border border-slate-800 text-white rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          isFullscreen
            ? 'w-full h-full rounded-none border-none'
            : 'max-w-3xl w-full max-h-[90vh]'
        }`}
      >
        {/* Focus Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Deep Work Focus Session
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              id="pomodoro-settings-toggle"
              type="button"
              onClick={() => setShowSettings((prev) => !prev)}
              className={`p-2 rounded-xl transition cursor-pointer ${
                showSettings
                  ? 'bg-emerald-600/20 text-emerald-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Timer settings"
              aria-label="Timer settings"
              aria-expanded={showSettings}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
              title={isFullscreen ? 'Exit full screen' : 'Full screen'}
              aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
              aria-label="Close focus timer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="px-6 py-4 bg-slate-800/70 border-b border-slate-800 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Pomodoro Settings
              </span>
              <button
                type="button"
                onClick={() => updateSettings(DEFAULT_POMODORO_SETTINGS)}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer"
              >
                Reset defaults
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
              <div>
                <label
                  htmlFor="pomodoro-setting-focus"
                  className="block text-[11px] font-medium text-slate-400 mb-1"
                >
                  Focus (min)
                </label>
                <input
                  id="pomodoro-setting-focus"
                  type="number"
                  min={1}
                  max={180}
                  value={settings.focus}
                  onChange={(e) => updateSettings({ focus: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label
                  htmlFor="pomodoro-setting-short"
                  className="block text-[11px] font-medium text-slate-400 mb-1"
                >
                  Short Break (min)
                </label>
                <input
                  id="pomodoro-setting-short"
                  type="number"
                  min={1}
                  max={60}
                  value={settings.short}
                  onChange={(e) => updateSettings({ short: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label
                  htmlFor="pomodoro-setting-long"
                  className="block text-[11px] font-medium text-slate-400 mb-1"
                >
                  Long Break (min)
                </label>
                <input
                  id="pomodoro-setting-long"
                  type="number"
                  min={1}
                  max={120}
                  value={settings.long}
                  onChange={(e) => updateSettings({ long: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label
                  htmlFor="pomodoro-setting-long-every"
                  className="block text-[11px] font-medium text-slate-400 mb-1"
                >
                  Long Every (cycles)
                </label>
                <input
                  id="pomodoro-setting-long-every"
                  type="number"
                  min={1}
                  max={12}
                  value={settings.longEvery}
                  onChange={(e) => updateSettings({ longEvery: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex items-center justify-between sm:justify-start gap-2 pb-1">
                <label
                  htmlFor="pomodoro-setting-autostart"
                  className="text-[11px] font-medium text-slate-300 cursor-pointer"
                >
                  Auto-start
                </label>
                <button
                  id="pomodoro-setting-autostart"
                  type="button"
                  role="switch"
                  aria-checked={settings.autoStart}
                  onClick={() => updateSettings({ autoStart: !settings.autoStart })}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    settings.autoStart ? 'bg-emerald-500' : 'bg-slate-600'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      settings.autoStart ? 'translate-x-4' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Focus Modal Content */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-5 gap-6 p-6 sm:p-8">
          {/* Left Column: Timer & Controls (3 cols) */}
          <div className="md:col-span-3 flex flex-col items-center justify-center space-y-6">
            {/* Mode Tabs */}
            <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-2xl border border-slate-700/60">
              <button
                type="button"
                onClick={() => switchMode('focus', false)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  timerMode === 'focus'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Focus ({settings.focus}m)
              </button>
              <button
                type="button"
                onClick={() => switchMode('short_break', false)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  timerMode === 'short_break'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Short Break ({settings.short}m)
              </button>
              <button
                type="button"
                onClick={() => switchMode('long_break', false)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  timerMode === 'long_break'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Long Break ({settings.long}m)
              </button>
            </div>

            {/* Circular Timer Display */}
            <div className="relative flex items-center justify-center">
              <svg className="w-56 h-56 sm:w-64 sm:h-64 transform -rotate-90">
                <circle
                  cx="50%"
                  cy="50%"
                  r="44%"
                  className="stroke-slate-800 stroke-[8px] fill-transparent"
                />
                <circle
                  cx="50%"
                  cy="50%"
                  r="44%"
                  className={`stroke-[8px] fill-transparent transition-all duration-1000 ${
                    timerMode === 'focus' ? 'stroke-emerald-500' : 'stroke-teal-400'
                  }`}
                  strokeDasharray="550"
                  strokeDashoffset={550 - (550 * progressPercent) / 100}
                  strokeLinecap="round"
                />
              </svg>

              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-5xl sm:text-6xl font-black font-mono tracking-tight">
                  {formatTime(timeLeft)}
                </span>
                <span className="text-xs text-slate-400 uppercase font-semibold tracking-wider mt-1">
                  {timerMode === 'focus'
                    ? 'Focus Interval'
                    : timerMode === 'long_break'
                    ? 'Long Break'
                    : 'Short Break'}
                </span>
                <span className="text-[11px] text-slate-500 mt-1">
                  Sessions: {completedFocusCount} • Long every {settings.longEvery}
                </span>
              </div>
            </div>

            {/* Play/Pause & Reset Actions */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={toggleTimer}
                className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform active:scale-95 cursor-pointer ${
                  isRunning
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
                aria-label={isRunning ? 'Pause timer' : 'Start timer'}
              >
                {isRunning ? (
                  <Pause className="w-6 h-6 fill-white" />
                ) : (
                  <Play className="w-6 h-6 fill-white ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="w-12 h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
                title="Reset timer"
                aria-label="Reset timer"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>

            {/* Ambient Sound Engine Selector */}
            <div className="flex flex-col items-center gap-2 pt-2">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Headphones className="w-3.5 h-3.5" />
                <span>Ambient Audio (Web Audio Synth):</span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                {[
                  { id: 'off', label: 'Mute' },
                  { id: 'binaural40', label: '40Hz Gamma' },
                  { id: 'rain', label: 'Rain' },
                  { id: 'whitenoise', label: 'White Noise' },
                  { id: 'stream', label: 'Stream' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      setSoundType(
                        s.id as 'off' | 'binaural40' | 'rain' | 'stream' | 'whitenoise'
                      )
                    }
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                      soundType === s.id
                        ? 'bg-slate-700 text-white font-bold'
                        : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {soundType !== 'off' && (
                <div className="flex items-center gap-2 mt-1">
                  <VolumeX className="w-3 h-3 text-slate-500" />
                  <input
                    type="range"
                    min="0"
                    max="0.5"
                    step="0.02"
                    value={soundVolume}
                    onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
                    className="w-24 accent-emerald-500 cursor-pointer"
                    aria-label="Sound volume"
                  />
                  <Volume2 className="w-3 h-3 text-slate-500" />
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Task Context or General Session (2 cols) */}
          <div className="md:col-span-2 border-t md:border-t-0 md:border-l border-slate-800 pt-6 md:pt-0 md:pl-6 flex flex-col justify-between">
            {latestTask ? (
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    Active Focus Goal
                  </span>
                  <h3 className="text-lg font-bold text-white mt-1">{latestTask.title}</h3>
                  {latestTask.description && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {latestTask.description}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Logged: {latestTask.actualMinutes || 0}m
                  </p>
                </div>

                {/* Subtasks Checklist */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
                    <span>Subtasks</span>
                    <span>
                      {latestTask.subtasks.filter((s) => s.completed).length}/
                      {latestTask.subtasks.length}
                    </span>
                  </div>

                  {latestTask.subtasks.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-2">
                      No subtasks defined. Stay locked on the primary task.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {latestTask.subtasks.map((st) => (
                        <div
                          key={st.id}
                          onClick={() => handleToggleSubtask(st.id)}
                          className={`flex items-center gap-2 p-2 rounded-xl transition cursor-pointer ${
                            st.completed
                              ? 'bg-slate-800/40 text-slate-500 line-through'
                              : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                              st.completed
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-slate-600'
                            }`}
                          >
                            {st.completed && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span className="text-xs font-medium truncate">{st.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    <span>Single-Task Focus Sprint</span>
                  </span>
                  <h3 className="text-base font-bold text-white mt-1">
                    Zero-Distraction Work Block
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Select a single priority to focus on during this {settings.focus}-minute sprint.
                  </p>
                </div>

                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                  <label htmlFor="custom-focus-goal" className="text-xs font-semibold text-slate-300 block mb-1">
                    What are you working on right now?
                  </label>
                  <input
                    id="custom-focus-goal"
                    type="text"
                    value={customGoal}
                    onChange={(e) => setCustomGoal(e.target.value)}
                    placeholder="e.g. Write Introduction, Solve 5 problems, Review notes..."
                    className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40 text-xs text-slate-400 space-y-1.5">
                  <p className="font-semibold text-slate-300">Rules for this session:</p>
                  <p>• Silence notifications on your phone</p>
                  <p>• Keep only relevant browser tabs open</p>
                  <p>• Avoid task switching until the bell rings</p>
                </div>
              </div>
            )}

            {/* Session Stats */}
            <div className="pt-4 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
              <span>Time in session:</span>
              <span className="font-mono font-bold text-slate-200">
                {Math.floor(sessionCompletedSeconds / 60)}m {sessionCompletedSeconds % 60}s
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
