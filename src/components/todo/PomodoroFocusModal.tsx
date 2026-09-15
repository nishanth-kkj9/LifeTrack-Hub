import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  CheckCircle2,
  Circle,
  Sparkles,
  Maximize2,
  Minimize2,
  Headphones,
  Check,
} from 'lucide-react';
import { Task, Subtask } from '../../types/index.ts';
import {
  playFocusBellSound,
  playTaskCompleteSound,
  focusSoundEngine,
  triggerTaskConfetti,
} from '../../lib/todoUtils.ts';

interface PomodoroFocusModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateTask: (task: Task) => void;
}

type TimerMode = 'focus' | 'short_break' | 'long_break';

export const PomodoroFocusModal: React.FC<PomodoroFocusModalProps> = ({
  task,
  isOpen,
  onClose,
  onUpdateTask,
}) => {
  const [timerMode, setTimerMode] = useState<TimerMode>('focus');
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 mins in seconds
  const [isRunning, setIsRunning] = useState(false);
  const [soundType, setSoundType] = useState<'off' | 'binaural40' | 'rain' | 'stream' | 'whitenoise'>('binaural40');
  const [soundVolume, setSoundVolume] = useState(0.2);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sessionCompletedSeconds, setSessionCompletedSeconds] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Set default time based on mode
  useEffect(() => {
    setIsRunning(false);
    if (timerMode === 'focus') setTimeLeft(25 * 60);
    else if (timerMode === 'short_break') setTimeLeft(5 * 60);
    else if (timerMode === 'long_break') setTimeLeft(15 * 60);
  }, [timerMode]);

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

  // Main countdown loop
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleTimerComplete();
            return 0;
          }
          if (timerMode === 'focus') {
            setSessionCompletedSeconds((s) => s + 1);
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, timerMode]);

  if (!isOpen || !task) return null;

  const handleTimerComplete = () => {
    setIsRunning(false);
    playFocusBellSound();
    triggerTaskConfetti();

    if (timerMode === 'focus') {
      // Log 25 mins to task
      const currentActual = task.actualMinutes || 0;
      onUpdateTask({
        ...task,
        actualMinutes: currentActual + 25,
      });
      setTimerMode('short_break');
    } else {
      setTimerMode('focus');
    }
  };

  const toggleTimer = () => {
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setIsRunning(false);
    if (timerMode === 'focus') setTimeLeft(25 * 60);
    else if (timerMode === 'short_break') setTimeLeft(5 * 60);
    else if (timerMode === 'long_break') setTimeLeft(15 * 60);
  };

  const handleToggleSubtask = (subtaskId: string) => {
    const updatedSubtasks = task.subtasks.map((s) =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    const allDone = updatedSubtasks.length > 0 && updatedSubtasks.every((s) => s.completed);
    if (!task.subtasks.find((s) => s.id === subtaskId)?.completed) {
      playTaskCompleteSound();
    }
    onUpdateTask({
      ...task,
      subtasks: updatedSubtasks,
      completed: allDone ? true : task.completed,
      status: allDone ? 'done' : task.status,
    });
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const totalModeDuration =
    timerMode === 'focus' ? 25 * 60 : timerMode === 'short_break' ? 5 * 60 : 15 * 60;
  const progressPercent = Math.round(((totalModeDuration - timeLeft) / totalModeDuration) * 100);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md transition-all p-4 ${
        isFullscreen ? 'p-0' : 'p-4'
      }`}
    >
      <div
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
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
              title={isFullscreen ? 'Exit full screen' : 'Full screen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() => {
                focusSoundEngine.stop();
                onClose();
              }}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Focus Modal Content */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-5 gap-6 p-6 sm:p-8">
          {/* Left Column: Timer & Controls (3 cols) */}
          <div className="md:col-span-3 flex flex-col items-center justify-center space-y-6">
            {/* Mode Tabs */}
            <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-2xl border border-slate-700/60">
              <button
                onClick={() => setTimerMode('focus')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  timerMode === 'focus'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Focus (25m)
              </button>
              <button
                onClick={() => setTimerMode('short_break')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  timerMode === 'short_break'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Short Break (5m)
              </button>
              <button
                onClick={() => setTimerMode('long_break')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  timerMode === 'long_break'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Long Break (15m)
              </button>
            </div>

            {/* Big Timer Clock Display */}
            <div className="relative flex flex-col items-center justify-center">
              <div className="font-mono text-6xl sm:text-7xl font-black tracking-tight text-white select-none">
                {formatTime(timeLeft)}
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-2">
                {timerMode === 'focus' ? '🎯 Stay in the Zone' : '☕ Relax & Stretch'}
              </p>

              {/* Circular or Linear Progress Bar */}
              <div className="w-56 sm:w-64 bg-slate-800 h-2 rounded-full overflow-hidden mt-4">
                <div
                  className={`h-full transition-all duration-1000 ${
                    timerMode === 'focus'
                      ? 'bg-indigo-500'
                      : timerMode === 'short_break'
                      ? 'bg-emerald-500'
                      : 'bg-sky-500'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Play / Pause / Reset Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTimer}
                className={`px-8 py-3.5 rounded-2xl font-black text-sm tracking-wide transition-all duration-200 flex items-center gap-2 cursor-pointer shadow-lg active:scale-95 ${
                  isRunning
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30'
                }`}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-4 h-4 fill-slate-950" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>Start Focus</span>
                  </>
                )}
              </button>

              <button
                onClick={handleReset}
                className="p-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl transition cursor-pointer"
                title="Reset timer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Ambient Sound Synthesizer Selector */}
            <div className="w-full bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Headphones className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Synthesized Focus Ambience</span>
                </span>
                {soundType !== 'off' && (
                  <span className="text-[10px] text-emerald-400 font-mono">
                    {isRunning ? 'Playing live' : 'Ready (starts on Play)'}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { key: 'binaural40', label: '🧠 40Hz Alpha' },
                  { key: 'rain', label: '🌧️ Rain' },
                  { key: 'whitenoise', label: '🌊 Stream' },
                  { key: 'off', label: '🔇 Off' },
                ].map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setSoundType(s.key as any)}
                    className={`py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                      soundType === s.key
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-700/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Active Task Checklist & Notes (2 cols) */}
          <div className="md:col-span-2 flex flex-col bg-slate-800/40 rounded-2xl border border-slate-800 p-4 space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block mb-1">
                Active Target
              </span>
              <h3 className="font-bold text-base text-white leading-snug">{task.title}</h3>
              {task.description && (
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{task.description}</p>
              )}
            </div>

            {/* Checklist during focus */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold uppercase tracking-wider text-slate-400 text-[10px]">
                  Step-by-Step Checklist
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length}
                </span>
              </div>

              {task.subtasks.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">
                  No subtasks. Stay focused on the main task until the timer rings!
                </p>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {task.subtasks.map((subtask) => (
                    <div
                      key={subtask.id}
                      onClick={() => handleToggleSubtask(subtask.id)}
                      className={`flex items-start gap-2.5 p-2 rounded-xl border text-xs transition cursor-pointer ${
                        subtask.completed
                          ? 'bg-slate-800/40 border-slate-700 text-slate-400 line-through'
                          : 'bg-slate-800 border-slate-700/80 text-slate-200 hover:border-indigo-500'
                      }`}
                    >
                      <button className="mt-0.5 text-slate-400">
                        {subtask.completed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Circle className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <span className="flex-1 font-medium">{subtask.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stats strip */}
            <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Logged total: {task.actualMinutes || 0}m</span>
              <span className="text-indigo-400 font-bold">🎯 Keep going!</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
