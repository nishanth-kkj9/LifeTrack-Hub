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
  const [sleepHours, setSleepHours] = useState<number | undefined>(existingMetric?.sleepHours);
  const [sleepQuality, setSleepQuality] = useState<number | undefined>(existingMetric?.sleepQuality);
  const [energyLevel, setEnergyLevel] = useState<number | undefined>(existingMetric?.energyLevel);
  const [moodLevel, setMoodLevel] = useState<number | undefined>(existingMetric?.moodLevel);
  const [stressLevel, setStressLevel] = useState<number | undefined>(existingMetric?.stressLevel);
  const [waterLitres, setWaterLitres] = useState<number | undefined>(existingMetric?.waterLitres);
  const [focusHours, setFocusHours] = useState<number | undefined>(existingMetric?.focusHours);
  const [workoutDone, setWorkoutDone] = useState<boolean | undefined>(existingMetric?.workoutDone);
  const [journalNotes, setJournalNotes] = useState<string>(existingMetric?.journalNotes ?? '');

  useEffect(() => {
    if (!isOpen) return;
    if (existingMetric) {
      setDateStr(existingMetric.date || selectedDate);
      setSleepHours(existingMetric.sleepHours);
      setSleepQuality(existingMetric.sleepQuality);
      setEnergyLevel(existingMetric.energyLevel);
      setMoodLevel(existingMetric.moodLevel);
      setStressLevel(existingMetric.stressLevel);
      setWaterLitres(existingMetric.waterLitres);
      setFocusHours(existingMetric.focusHours);
      setWorkoutDone(existingMetric.workoutDone);
      setJournalNotes(existingMetric.journalNotes ?? '');
    } else {
      setDateStr(selectedDate);
      setSleepHours(undefined);
      setSleepQuality(undefined);
      setEnergyLevel(undefined);
      setMoodLevel(undefined);
      setStressLevel(undefined);
      setWaterLitres(undefined);
      setFocusHours(undefined);
      setWorkoutDone(undefined);
      setJournalNotes('');
    }
  }, [existingMetric, selectedDate, isOpen]);

  if (!isOpen) return null;

  const trimmedNotes = journalNotes.trim();
  const hasAnyMetricSet =
    sleepHours !== undefined ||
    sleepQuality !== undefined ||
    energyLevel !== undefined ||
    moodLevel !== undefined ||
    stressLevel !== undefined ||
    waterLitres !== undefined ||
    focusHours !== undefined ||
    workoutDone !== undefined ||
    trimmedNotes.length > 0 ||
    existingMetric?.stepsCount !== undefined ||
    existingMetric?.screenTimeHours !== undefined;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasAnyMetricSet) return;

    const metric: DailyLifeMetric = {
      id: existingMetric?.id || `metric-${dateStr}`,
      date: dateStr,
      updatedAt: Date.now(),
    };
    if (sleepHours !== undefined) metric.sleepHours = sleepHours;
    if (sleepQuality !== undefined) metric.sleepQuality = sleepQuality;
    if (energyLevel !== undefined) metric.energyLevel = energyLevel;
    if (moodLevel !== undefined) metric.moodLevel = moodLevel;
    if (stressLevel !== undefined) metric.stressLevel = stressLevel;
    if (waterLitres !== undefined) metric.waterLitres = waterLitres;
    if (existingMetric?.stepsCount !== undefined) metric.stepsCount = existingMetric.stepsCount;
    if (focusHours !== undefined) metric.focusHours = focusHours;
    if (existingMetric?.screenTimeHours !== undefined) metric.screenTimeHours = existingMetric.screenTimeHours;
    if (workoutDone !== undefined) metric.workoutDone = workoutDone;
    if (trimmedNotes.length > 0) metric.journalNotes = trimmedNotes;

    onSaveMetric(metric);
    onClose();
  };

  const RatingChips = ({
    value,
    onChange,
    labels,
    metricName,
  }: {
    value: number | undefined;
    onChange: (val: number | undefined) => void;
    labels: string[];
    metricName: string;
  }) => (
    <div className="flex items-center gap-1.5 flex-wrap" data-testid={`metric-group-${metricName}`}>
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          type="button"
          aria-pressed={value === rating}
          onClick={() => onChange(value === rating ? undefined : rating)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
            value === rating
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
          }`}
        >
          {rating} · {labels[rating - 1]}
        </button>
      ))}
      <button
        type="button"
        aria-pressed={value === undefined}
        onClick={() => onChange(undefined)}
        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
          value === undefined
            ? 'bg-slate-200/80 text-slate-700 border-slate-300'
            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
        }`}
      >
        Skip
      </button>
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
                Log only the metrics you want to track today; leave others skipped.
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
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="sleep-hours-slider" className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                <Moon className="w-4 h-4 text-indigo-600" />
                <span>Sleep Duration</span>
              </label>
              <div className="flex items-center gap-1.5">
                <span
                  data-testid="sleep-hours-value"
                  className={`text-xs font-mono font-extrabold px-2.5 py-0.5 rounded-full ${
                    sleepHours !== undefined
                      ? 'bg-indigo-100 text-indigo-800'
                      : 'bg-slate-200/70 text-slate-600'
                  }`}
                >
                  {sleepHours !== undefined ? `${sleepHours} hrs` : 'Not set'}
                </span>
                <button
                  type="button"
                  onClick={() => setSleepHours(undefined)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                    sleepHours === undefined
                      ? 'bg-slate-200/80 text-slate-700 border-slate-300'
                      : 'bg-white text-slate-600 border-indigo-200 hover:bg-indigo-100/60'
                  }`}
                >
                  Skip
                </button>
              </div>
            </div>
            <input
              id="sleep-hours-slider"
              type="range"
              min="3"
              max="12"
              step="0.5"
              value={sleepHours ?? 7.5}
              onChange={(e) => setSleepHours(parseFloat(e.target.value))}
              className={`w-full accent-indigo-600 cursor-pointer h-2 bg-indigo-200 rounded-lg ${
                sleepHours === undefined ? 'opacity-50' : ''
              }`}
            />
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-bold text-indigo-950">Sleep Quality</p>
                {sleepQuality === undefined && (
                  <span className="text-[11px] font-medium text-slate-500">Not set</span>
                )}
              </div>
              <RatingChips
                value={sleepQuality}
                onChange={setSleepQuality}
                labels={['Restless', 'Fair', 'Good', 'Restful', 'Excellent']}
                metricName="sleepQuality"
              />
            </div>
          </div>

          {/* Energy & Mood Level */}
          <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-100/80 space-y-3.5">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-600" />
                  <span>Energy Rating</span>
                </p>
                {energyLevel === undefined && (
                  <span className="text-[11px] font-medium text-slate-500">Not set</span>
                )}
              </div>
              <RatingChips
                value={energyLevel}
                onChange={setEnergyLevel}
                labels={['Exhausted', 'Low', 'Moderate', 'Vibrant', 'Peak']}
                metricName="energyLevel"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <Smile className="w-4 h-4 text-amber-600" />
                  <span>Mood Rating</span>
                </p>
                {moodLevel === undefined && (
                  <span className="text-[11px] font-medium text-slate-500">Not set</span>
                )}
              </div>
              <RatingChips
                value={moodLevel}
                onChange={setMoodLevel}
                labels={['Down', 'Low', 'Balanced', 'Happy', 'Unstoppable']}
                metricName="moodLevel"
              />
            </div>
          </div>

          {/* Stress & Hydration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 bg-rose-50/60 rounded-2xl border border-rose-100/80 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="stress-level-select" className="text-xs font-bold text-rose-950 block">
                  Stress Rating
                </label>
                <button
                  type="button"
                  onClick={() => setStressLevel(undefined)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                    stressLevel === undefined
                      ? 'bg-slate-200/80 text-slate-700 border-slate-300'
                      : 'bg-white text-slate-600 border-rose-200 hover:bg-rose-100/60'
                  }`}
                >
                  Skip
                </button>
              </div>
              <select
                id="stress-level-select"
                value={stressLevel ?? ''}
                onChange={(e) => setStressLevel(e.target.value === '' ? undefined : Number(e.target.value))}
                className="w-full text-xs p-2.5 rounded-xl border border-rose-200/80 bg-white font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="">Not set (Skip)</option>
                <option value={1}>1 - Relaxed / Calm</option>
                <option value={2}>2 - Low Stress</option>
                <option value={3}>3 - Moderate</option>
                <option value={4}>4 - High Stress</option>
                <option value={5}>5 - Overwhelmed</option>
              </select>
            </div>

            <div className="p-3.5 bg-sky-50/60 rounded-2xl border border-sky-100/80 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="water-litres-input" className="text-xs font-bold text-sky-950 block flex items-center gap-1">
                  <Droplet className="w-3.5 h-3.5 text-sky-600" />
                  <span>Water Hydration (L)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setWaterLitres(undefined)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                    waterLitres === undefined
                      ? 'bg-slate-200/80 text-slate-700 border-slate-300'
                      : 'bg-white text-slate-600 border-sky-200 hover:bg-sky-100/60'
                  }`}
                >
                  Skip
                </button>
              </div>
              <input
                id="water-litres-input"
                type="number"
                step="0.25"
                min="0"
                max="8"
                placeholder="Not set"
                value={waterLitres ?? ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') {
                    setWaterLitres(undefined);
                    return;
                  }
                  const parsed = parseFloat(raw);
                  setWaterLitres(Number.isFinite(parsed) ? parsed : undefined);
                }}
                className="w-full text-xs p-2.5 rounded-xl border border-sky-200/80 bg-white font-mono font-bold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Focus Hours & Workout Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 bg-purple-50/60 rounded-2xl border border-purple-100/80 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="focus-hours-input" className="text-xs font-bold text-purple-950 block flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-purple-600" />
                  <span>Deep Focus (Hours)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setFocusHours(undefined)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                    focusHours === undefined
                      ? 'bg-slate-200/80 text-slate-700 border-slate-300'
                      : 'bg-white text-slate-600 border-purple-200 hover:bg-purple-100/60'
                  }`}
                >
                  Skip
                </button>
              </div>
              <input
                id="focus-hours-input"
                type="number"
                step="0.5"
                min="0"
                max="18"
                placeholder="Not set"
                value={focusHours ?? ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') {
                    setFocusHours(undefined);
                    return;
                  }
                  const parsed = parseFloat(raw);
                  setFocusHours(Number.isFinite(parsed) ? parsed : undefined);
                }}
                className="w-full text-xs p-2.5 rounded-xl border border-purple-200/80 bg-white font-mono font-bold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400"
              />
            </div>

            <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-100/80 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-emerald-950 flex items-center gap-1">
                  <Dumbbell className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Workout Completed</span>
                </p>
                {workoutDone === undefined && (
                  <span className="text-[11px] font-medium text-slate-500">Not set</span>
                )}
              </div>
              <div className="flex items-center gap-1.5" data-testid="metric-group-workoutDone">
                <button
                  type="button"
                  aria-pressed={workoutDone === true}
                  onClick={() => setWorkoutDone(true)}
                  className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold border inline-flex items-center justify-center gap-1 transition cursor-pointer ${
                    workoutDone === true
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-white border-emerald-200 text-slate-700 hover:bg-emerald-50'
                  }`}
                >
                  {workoutDone === true && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  <span>Yes</span>
                </button>
                <button
                  type="button"
                  aria-pressed={workoutDone === false}
                  onClick={() => setWorkoutDone(false)}
                  className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    workoutDone === false
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-emerald-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  No
                </button>
                <button
                  type="button"
                  aria-pressed={workoutDone === undefined}
                  onClick={() => setWorkoutDone(undefined)}
                  className={`py-1.5 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    workoutDone === undefined
                      ? 'bg-slate-200/80 text-slate-700 border-slate-300'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  Skip
                </button>
              </div>
            </div>
          </div>

          {/* Quick Reflection / Notes */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="journal-notes-textarea" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                <span>Daily Reflection Note</span>
              </label>
              <button
                type="button"
                onClick={() => setJournalNotes('')}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                  trimmedNotes.length === 0
                    ? 'bg-slate-200/80 text-slate-700 border-slate-300'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Skip
              </button>
            </div>
            <textarea
              id="journal-notes-textarea"
              rows={2}
              placeholder="Not set — what went well today? Any key wins or observations..."
              value={journalNotes}
              onChange={(e) => setJournalNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
            />
          </div>

          {!hasAnyMetricSet && (
            <p className="text-[11px] font-medium text-slate-500 text-right">
              Set at least one metric above before saving.
            </p>
          )}

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
              disabled={!hasAnyMetricSet}
              className="px-5 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-900"
            >
              Save Metrics
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

