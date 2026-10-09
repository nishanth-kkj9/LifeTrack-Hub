import React, { useState, useEffect } from 'react';
import {
  X,
  Moon,
  Smile,
  Zap,
  Activity,
  Droplet,
  Dumbbell,
  Clock,
  BookOpen,
  Check,
  Calendar,
} from 'lucide-react';
import { DailyLifeMetric } from '../../types/index.ts';
import { getLocalDateString } from '../../lib/dateUtils.ts';
import { useModalFocus } from '../../hooks/useModalFocus.ts';

interface DailyLifeCheckinModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingMetric?: DailyLifeMetric | null;
  onSaveMetric: (metric: DailyLifeMetric) => void;
  selectedDate?: string;
}

export const DailyLifeCheckinModal: React.FC<DailyLifeCheckinModalProps> = ({
  isOpen,
  onClose,
  existingMetric,
  onSaveMetric,
  selectedDate = getLocalDateString(),
}) => {
  const { modalRef } = useModalFocus<HTMLDivElement>({ isOpen, onClose });

  const [dateStr, setDateStr] = useState(selectedDate);
  const [sleepHours, setSleepHours] = useState<number>(existingMetric?.sleepHours ?? 7.5);
  const [sleepQuality, setSleepQuality] = useState<number>(existingMetric?.sleepQuality ?? 4);
  const [energyLevel, setEnergyLevel] = useState<number>(existingMetric?.energyLevel ?? 4);
  const [moodLevel, setMoodLevel] = useState<number>(existingMetric?.moodLevel ?? 4);
  const [stressLevel, setStressLevel] = useState<number>(existingMetric?.stressLevel ?? 2);
  const [waterLitres, setWaterLitres] = useState<number>(existingMetric?.waterLitres ?? 2.5);
  const [focusHours, setFocusHours] = useState<number>(existingMetric?.focusHours ?? 4);
  const [workoutDone, setWorkoutDone] = useState<boolean>(existingMetric?.workoutDone ?? false);
  const [journalNotes, setJournalNotes] = useState<string>(existingMetric?.journalNotes ?? '');

  useEffect(() => {
    if (existingMetric) {
      setDateStr(existingMetric.date || selectedDate);
      setSleepHours(existingMetric.sleepHours ?? 7.5);
      setSleepQuality(existingMetric.sleepQuality ?? 4);
      setEnergyLevel(existingMetric.energyLevel ?? 4);
      setMoodLevel(existingMetric.moodLevel ?? 4);
      setStressLevel(existingMetric.stressLevel ?? 2);
      setWaterLitres(existingMetric.waterLitres ?? 2.5);
      setFocusHours(existingMetric.focusHours ?? 4);
      setWorkoutDone(existingMetric.workoutDone ?? false);
      setJournalNotes(existingMetric.journalNotes ?? '');
    } else {
      setDateStr(selectedDate);
    }
  }, [existingMetric, selectedDate, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const metric: DailyLifeMetric = {
      id: existingMetric?.id || `metric-${dateStr}`,
      date: dateStr,
      sleepHours,
      sleepQuality,
      energyLevel,
      moodLevel,
      stressLevel,
      waterLitres,
      focusHours,
      workoutDone,
      journalNotes: journalNotes.trim(),
      updatedAt: Date.now(),
    };
    onSaveMetric(metric);
    onClose();
  };

  const RatingChips = ({
    value,
    onChange,
    labels,
  }: {
    value: number;
    onChange: (val: number) => void;
    labels: string[];
  }) => (
    <div className="flex items-center gap-1.5 flex-wrap">
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          type="button"
          onClick={() => onChange(rating)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
            value === rating
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
          }`}
        >
          {rating} · {labels[rating - 1]}
        </button>
      ))}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-checkin-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl shadow-slate-900/10 w-full max-w-lg p-6 sm:p-7 space-y-5 my-8 animate-scaleUp text-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-purple-50 border border-purple-200/80 flex items-center justify-center text-purple-700 shadow-xs">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 id="daily-checkin-modal-title" className="text-lg font-extrabold text-slate-900 tracking-tight">
                Daily Life Metrics Check-In
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Log well-being, sleep, energy & focus for correlation insights.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Date Selector */}
          <div>
            <label htmlFor="checkin-date-input" className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Log Date</span>
            </label>
            <input
              id="checkin-date-input"
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
            />
          </div>

          {/* Sleep Hours & Sleep Quality */}
          <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100/80 space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="sleep-hours-slider" className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                <Moon className="w-4 h-4 text-indigo-600" />
                <span>Sleep Duration</span>
              </label>
              <span className="text-xs font-mono font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">{sleepHours} hrs</span>
            </div>
            <input
              id="sleep-hours-slider"
              type="range"
              min="3"
              max="12"
              step="0.5"
              value={sleepHours}
              onChange={(e) => setSleepHours(parseFloat(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer h-2 bg-indigo-200 rounded-lg"
            />
            <div>
              <p className="text-[11px] font-bold text-indigo-950 mb-1.5">Sleep Quality</p>
              <RatingChips
                value={sleepQuality}
                onChange={setSleepQuality}
                labels={['Restless', 'Fair', 'Good', 'Restful', 'Excellent']}
              />
            </div>
          </div>

          {/* Energy & Mood Level */}
          <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-100/80 space-y-3.5">
            <div>
              <p className="text-xs font-bold text-amber-950 mb-1.5 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-600" />
                <span>Energy Rating</span>
              </p>
              <RatingChips
                value={energyLevel}
                onChange={setEnergyLevel}
                labels={['Exhausted', 'Low', 'Moderate', 'Vibrant', 'Peak']}
              />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-950 mb-1.5 flex items-center gap-1.5">
                <Smile className="w-4 h-4 text-amber-600" />
                <span>Mood Rating</span>
              </p>
              <RatingChips
                value={moodLevel}
                onChange={setMoodLevel}
                labels={['Down', 'Low', 'Balanced', 'Happy', 'Unstoppable']}
              />
            </div>
          </div>

          {/* Stress & Hydration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 bg-rose-50/60 rounded-2xl border border-rose-100/80 space-y-2">
              <label htmlFor="stress-level-select" className="text-xs font-bold text-rose-950 block">Stress Rating</label>
              <select
                id="stress-level-select"
                value={stressLevel}
                onChange={(e) => setStressLevel(Number(e.target.value))}
                className="w-full text-xs p-2.5 rounded-xl border border-rose-200/80 bg-white font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value={1}>1 - Relaxed / Calm</option>
                <option value={2}>2 - Low Stress</option>
                <option value={3}>3 - Moderate</option>
                <option value={4}>4 - High Stress</option>
                <option value={5}>5 - Overwhelmed</option>
              </select>
            </div>

            <div className="p-3.5 bg-sky-50/60 rounded-2xl border border-sky-100/80 space-y-2">
              <label htmlFor="water-litres-input" className="text-xs font-bold text-sky-950 block flex items-center gap-1">
                <Droplet className="w-3.5 h-3.5 text-sky-600" />
                <span>Water Hydration (L)</span>
              </label>
              <input
                id="water-litres-input"
                type="number"
                step="0.25"
                min="0"
                max="8"
                value={waterLitres}
                onChange={(e) => setWaterLitres(parseFloat(e.target.value) || 0)}
                className="w-full text-xs p-2.5 rounded-xl border border-sky-200/80 bg-white font-mono font-bold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Focus Hours & Workout Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 bg-purple-50/60 rounded-2xl border border-purple-100/80 space-y-2">
              <label htmlFor="focus-hours-input" className="text-xs font-bold text-purple-950 block flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-purple-600" />
                <span>Deep Focus (Hours)</span>
              </label>
              <input
                id="focus-hours-input"
                type="number"
                step="0.5"
                min="0"
                max="18"
                value={focusHours}
                onChange={(e) => setFocusHours(parseFloat(e.target.value) || 0)}
                className="w-full text-xs p-2.5 rounded-xl border border-purple-200/80 bg-white font-mono font-bold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-100/80 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-950 flex items-center gap-1">
                  <Dumbbell className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Workout Completed</span>
                </p>
                <p className="text-[11px] text-emerald-700 font-medium">Gym, running, or sport</p>
              </div>
              <button
                type="button"
                onClick={() => setWorkoutDone(!workoutDone)}
                className={`w-7 h-7 rounded-lg border flex items-center justify-center transition cursor-pointer shadow-2xs ${
                  workoutDone ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white hover:border-slate-400'
                }`}
              >
                {workoutDone && <Check className="w-4 h-4 stroke-[3]" />}
              </button>
            </div>
          </div>

          {/* Quick Reflection / Notes */}
          <div>
            <label htmlFor="journal-notes-textarea" className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-slate-500" />
              <span>Daily Reflection Note</span>
            </label>
            <textarea
              id="journal-notes-textarea"
              rows={2}
              placeholder="What went well today? Any key wins or observations..."
              value={journalNotes}
              onChange={(e) => setJournalNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="daily-checkin-save-btn"
              className="px-5 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition shadow-xs cursor-pointer"
            >
              Save Metrics
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
