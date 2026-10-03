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
  Target,
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
  const [customGoal, setCustomGoal] = useState('');

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

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        focusSoundEngine.stop();
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleTimerComplete = () => {
    setIsRunning(false);
    playFocusBellSound();
    triggerTaskConfetti();

    if (timerMode === 'focus') {
      if (task) {
        const currentActual = task.actualMinutes || 0;
        onUpdateTask({
          ...task,
          actualMinutes: currentActual + 25,
        });
      }
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
    if (!task) return;
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
      role="dialog"
      aria-modal="true"
      aria-label="Pomodoro focus timer"
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
              aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() => {
                focusSoundEngine.stop();
                onClose();
              }}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
              aria-label="Close focus timer"
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
                type="button"
                onClick={() => setTimerMode('focus')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  timerMode === 'focus'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Focus (25m)
              </button>
              <button
                type="button"
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
                type="button"
                onClick={() => setTimerMode('long_break')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  timerMode === 'long_break'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Long Break (15m)
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
                  {timerMode === 'focus' ? 'Focus Interval' : 'Rest & Recharge'}
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
            {task ? (
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    Active Focus Goal
                  </span>
                  <h3 className="text-lg font-bold text-white mt-1">{task.title}</h3>
                  {task.description && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                </div>

                {/* Subtasks Checklist */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
                    <span>Subtasks</span>
                    <span>
                      {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length}
                    </span>
                  </div>

                  {task.subtasks.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-2">
                      No subtasks defined. Stay locked on the primary task.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {task.subtasks.map((st) => (
                        <div
                          key={st.id}
                          onClick={() => handleToggleSubtask(st.id)}
                          className={`flex items-center gap-2 p-2 rounded-xl transition cursor-pointer ${
                            st.completed
                              ? 'bg-slate-800/40 text-slate-500 line-through'
                              : 'bg-slate-800 text-slate-200 hover:bg-slate-750'
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
                    Select a single priority to focus on during this 25-minute sprint.
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
