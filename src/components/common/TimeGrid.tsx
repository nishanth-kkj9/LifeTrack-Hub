import React from 'react';
import { CheckCircle2, Circle, Play, Plus, GraduationCap } from 'lucide-react';
import { ExamReminder, Task } from '../../types/index.ts';
import { formatAppTime, getLocalDateString, parseLocalDate } from '../../lib/dateUtils.ts';
import { useTimeFormat } from '../../hooks/useTimeFormat.ts';

export const TIME_GRID_HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 07:00 to 22:00

export interface TimeGridProps {
  days: string[];
  tasks: Task[];
  exams?: ExamReminder[];
  onSelectTask?: (task: Task) => void;
  onCreateAt?: (date: string, time: string) => void;
  onToggleTask?: (task: Task, e: React.MouseEvent) => void;
  onStartFocus?: (task: Task) => void;
  onSelectExam?: (exam: ExamReminder) => void;
  selectedDate?: string;
  showAllDayRow?: boolean;
}

function getHourFromTime(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const h = parseInt(timeStr.split(':')[0], 10);
  return Number.isFinite(h) ? h : null;
}

export const TimeGrid: React.FC<TimeGridProps> = ({
  days,
  tasks,
  exams = [],
  onSelectTask,
  onCreateAt,
  onToggleTask,
  onStartFocus,
  onSelectExam,
  selectedDate,
  showAllDayRow = false,
}) => {
  const timeFormat = useTimeFormat();
  const todayStr = getLocalDateString();
  const isMultiDay = days.length > 1;
  const daySet = new Set(days);

  const relevantTasks = tasks.filter((t) => Boolean(t.dueDate && daySet.has(t.dueDate)));
  const relevantExams = exams.filter((e) => Boolean(e.examDate && daySet.has(e.examDate)));

  const hasEarly =
    relevantTasks.some((t) => {
      const h = getHourFromTime(t.dueTime);
      return h !== null && h < 7;
    }) ||
    relevantExams.some((e) => {
      const h = getHourFromTime(e.examTime);
      return h !== null && h < 7;
    });

  const hasLate =
    relevantTasks.some((t) => {
      const h = getHourFromTime(t.dueTime);
      return h !== null && h > 22;
    }) ||
    relevantExams.some((e) => {
      const h = getHourFromTime(e.examTime);
      return h !== null && h > 22;
    });

  const hasAllDayItems =
    showAllDayRow &&
    (relevantTasks.some((t) => !t.dueTime) || relevantExams.some((e) => !e.examTime));

  const formatHourLabel = (hour: number) =>
    formatAppTime(`${String(hour).padStart(2, '0')}:00`, timeFormat);

  const renderExamCard = (exam: ExamReminder) => (
    <button
      key={`exam-${exam.id}`}
      type="button"
      data-testid="timegrid-exam-card"
      onClick={(e) => {
        e.stopPropagation();
        onSelectExam?.(exam);
      }}
      className="w-full text-left p-2 rounded-xl border border-indigo-200 bg-indigo-50/90 hover:bg-indigo-100/80 text-indigo-950 transition flex items-center gap-1.5 cursor-pointer min-w-0"
    >
      <GraduationCap className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold truncate">{exam.subject}</p>
        {exam.examTime && (
          <p className="text-[10px] font-mono text-indigo-700 truncate">
            {formatAppTime(exam.examTime, timeFormat)}
          </p>
        )}
      </div>
    </button>
  );

  const renderTaskCard = (task: Task, compact: boolean) => (
    <div
      key={task.id}
      data-testid="timegrid-task-card"
      onClick={(e) => {
        e.stopPropagation();
        onSelectTask?.(task);
      }}
      className={`${
        compact ? 'p-1.5 rounded-xl' : 'p-2.5 rounded-2xl'
      } border transition flex items-center justify-between gap-2 cursor-pointer min-w-0 ${
        task.completed
          ? 'bg-slate-50 border-slate-200 opacity-60'
          : task.priority === 'urgent'
          ? 'bg-rose-50/80 border-rose-200'
          : task.priority === 'high'
          ? 'bg-amber-50/80 border-amber-200'
          : 'bg-indigo-50/70 border-indigo-200'
      }`}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {onToggleTask && (
          <button
            type="button"
            onClick={(e) => onToggleTask(task, e)}
            className="text-slate-400 hover:text-emerald-600 transition cursor-pointer shrink-0"
            aria-label={`${task.completed ? 'Reopen' : 'Complete'} ${task.title}`}
          >
            {task.completed ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 fill-emerald-100" />
            ) : (
              <Circle className="w-4 h-4" />
            )}
          </button>
        )}
        <span
          className={`font-bold text-xs truncate ${
            task.completed ? 'line-through text-slate-400' : 'text-slate-900'
          }`}
        >
          {task.title}
        </span>
        {task.dueTime && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/80 border border-slate-200/60 text-slate-600 shrink-0">
            {formatAppTime(task.dueTime, timeFormat)}
          </span>
        )}
        {!compact && task.estimatedMinutes && (
          <span className="text-[10px] text-slate-400 hidden sm:inline font-mono shrink-0">
            ~{task.estimatedMinutes}m
          </span>
        )}
      </div>

      {onStartFocus && !compact && (
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStartFocus(task);
            }}
            className="px-2 py-1 rounded-lg bg-white/80 hover:bg-white text-indigo-700 text-[10px] font-bold border border-indigo-200/60 transition flex items-center gap-1 cursor-pointer"
          >
            <Play className="w-2.5 h-2.5 fill-indigo-700" />
            <span>Focus</span>
          </button>
        </div>
      )}
    </div>
  );

  const gridTemplateStyle = isMultiDay
    ? { gridTemplateColumns: `5.5rem repeat(${days.length}, minmax(0, 1fr))` }
    : undefined;

  return (
    <div
      data-testid="timegrid"
      className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-x-auto"
    >
      <div className={isMultiDay ? 'min-w-[680px] divide-y divide-slate-100' : 'divide-y divide-slate-100'}>
        {/* Multi-day Column Header */}
        {isMultiDay && (
          <div
            className="grid bg-slate-50/80 border-b border-slate-200/80"
            style={gridTemplateStyle}
          >
            <div className="p-2.5 text-[11px] font-mono font-semibold text-slate-400 border-r border-slate-100 text-right pr-3">
              Time
            </div>
            {days.map((day) => {
              const d = parseLocalDate(day);
              const isToday = day === todayStr;
              const isSelected = day === selectedDate;
              return (
                <div
                  key={day}
                  data-testid="timegrid-day-header"
                  data-date={day}
                  className={`p-2.5 text-center border-r last:border-r-0 border-slate-100 min-w-0 ${
                    isToday
                      ? 'bg-emerald-50/70'
                      : isSelected
                      ? 'bg-slate-100/70'
                      : ''
                  }`}
                >
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    {d.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div
                    className={`mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold font-mono tabular-nums ${
                      isToday
                        ? 'bg-emerald-600 text-white'
                        : isSelected
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-800'
                    }`}
                  >
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* All-day row (when enabled and untimed items exist) */}
        {hasAllDayItems && (
          <div
            className={
              isMultiDay
                ? 'grid items-stretch bg-slate-50/40'
                : 'flex items-start min-h-[56px] bg-slate-50/40'
            }
            style={gridTemplateStyle}
          >
            <div
              className={
                isMultiDay
                  ? 'p-2.5 text-[11px] font-mono font-bold text-slate-400 border-r border-slate-100 text-right pr-3'
                  : 'w-24 sm:w-28 p-3 text-[11px] font-mono font-bold text-slate-400 border-r border-slate-100 shrink-0 text-right pr-4'
              }
            >
              All day
            </div>
            {days.map((day) => {
              const allDayExams = relevantExams.filter((e) => e.examDate === day && !e.examTime);
              const allDayTasks = relevantTasks.filter((t) => t.dueDate === day && !t.dueTime);
              return (
                <div
                  key={`allday-${day}`}
                  className={`${
                    isMultiDay ? 'p-1.5 border-r last:border-r-0 border-slate-100 min-w-0' : 'flex-1 p-2'
                  } space-y-1`}
                >
                  {allDayExams.map(renderExamCard)}
                  {allDayTasks.map((t) => renderTaskCard(t, isMultiDay))}
                </div>
              );
            })}
          </div>
        )}

        {/* Early Morning Overflow Tray (< 07:00) */}
        {hasEarly && (
          <div
            className={
              isMultiDay
                ? 'grid items-stretch min-h-[60px] bg-slate-50/60'
                : 'flex items-start min-h-[68px] bg-slate-50/60 hover:bg-slate-50 transition'
            }
            style={gridTemplateStyle}
          >
            <div
              className={
                isMultiDay
                  ? 'p-2.5 text-[11px] font-mono font-bold text-slate-500 border-r border-slate-100 text-right pr-3'
                  : 'w-24 sm:w-28 p-3 text-[11px] font-mono font-bold text-slate-500 border-r border-slate-100 shrink-0 text-right pr-4'
              }
            >
              &lt; {formatAppTime('07:00', timeFormat)}
            </div>
            {days.map((day) => {
              const earlyExams = relevantExams.filter((e) => {
                if (e.examDate !== day) return false;
                const h = getHourFromTime(e.examTime);
                return h !== null && h < 7;
              });
              const earlyTasks = relevantTasks.filter((t) => {
                if (t.dueDate !== day) return false;
                const h = getHourFromTime(t.dueTime);
                return h !== null && h < 7;
              });
              return (
                <div
                  key={`early-${day}`}
                  className={`${
                    isMultiDay ? 'p-1.5 border-r last:border-r-0 border-slate-100 min-w-0' : 'flex-1 p-2'
                  } space-y-1.5`}
                >
                  {earlyExams.map(renderExamCard)}
                  {earlyTasks.map((t) => renderTaskCard(t, isMultiDay))}
                </div>
              );
            })}
          </div>
        )}

        {/* Main Hourly Grid (07:00 .. 22:00) */}
        {TIME_GRID_HOURS.map((hour) => {
          const timeStr = `${String(hour).padStart(2, '0')}:00`;
          return (
            <div
              key={hour}
              className={
                isMultiDay
                  ? 'grid items-stretch min-h-[64px]'
                  : 'flex items-stretch min-h-[68px] hover:bg-slate-50/50 transition'
              }
              style={gridTemplateStyle}
            >
              {/* Hour Label */}
              <div
                className={
                  isMultiDay
                    ? 'p-2.5 text-[11px] font-mono font-bold text-slate-400 border-r border-slate-100 text-right pr-3'
                    : 'w-24 sm:w-28 p-3 text-[11px] font-mono font-bold text-slate-400 border-r border-slate-100 shrink-0 text-right pr-4'
                }
              >
                {formatHourLabel(hour)}
              </div>

              {/* Day Columns */}
              {days.map((day) => {
                const hourExams = relevantExams.filter(
                  (e) => e.examDate === day && getHourFromTime(e.examTime) === hour
                );
                const hourTasks = relevantTasks.filter(
                  (t) => t.dueDate === day && getHourFromTime(t.dueTime) === hour
                );
                const isEmpty = hourExams.length === 0 && hourTasks.length === 0;

                return (
                  <div
                    key={`${day}-${hour}`}
                    data-testid="timegrid-slot"
                    data-date={day}
                    data-time={timeStr}
                    className={`${
                      isMultiDay
                        ? 'p-1.5 border-r last:border-r-0 border-slate-100 min-w-0 flex flex-col'
                        : 'flex-1 p-2 flex flex-col'
                    }`}
                  >
                    {isEmpty ? (
                      onCreateAt ? (
                        <button
                          type="button"
                          data-testid="timegrid-empty-slot"
                          data-date={day}
                          data-time={timeStr}
                          aria-label={`Schedule task on ${day} at ${formatHourLabel(hour)}`}
                          onClick={() => onCreateAt(day, timeStr)}
                          className="group w-full flex-1 min-h-[44px] rounded-xl border border-transparent hover:border-dashed hover:border-emerald-300 hover:bg-emerald-50/40 transition flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                        >
                          <span className="opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 text-[11px] font-semibold text-emerald-700 inline-flex items-center gap-1 transition-opacity">
                            <Plus className="w-3 h-3" />
                            {!isMultiDay && <span>Add</span>}
                          </span>
                        </button>
                      ) : (
                        <div className="flex-1 min-h-[44px]" />
                      )
                    ) : (
                      <div className="space-y-1.5">
                        {hourExams.map(renderExamCard)}
                        {hourTasks.map((t) => renderTaskCard(t, isMultiDay))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Late Night Overflow Tray (> 22:00) */}
        {hasLate && (
          <div
            className={
              isMultiDay
                ? 'grid items-stretch min-h-[60px] bg-slate-50/60'
                : 'flex items-start min-h-[68px] bg-slate-50/60 hover:bg-slate-50 transition'
            }
            style={gridTemplateStyle}
          >
            <div
              className={
                isMultiDay
                  ? 'p-2.5 text-[11px] font-mono font-bold text-slate-500 border-r border-slate-100 text-right pr-3'
                  : 'w-24 sm:w-28 p-3 text-[11px] font-mono font-bold text-slate-500 border-r border-slate-100 shrink-0 text-right pr-4'
              }
            >
              &gt; {formatAppTime('22:00', timeFormat)}
            </div>
            {days.map((day) => {
              const lateExams = relevantExams.filter((e) => {
                if (e.examDate !== day) return false;
                const h = getHourFromTime(e.examTime);
                return h !== null && h > 22;
              });
              const lateTasks = relevantTasks.filter((t) => {
                if (t.dueDate !== day) return false;
                const h = getHourFromTime(t.dueTime);
                return h !== null && h > 22;
              });
              return (
                <div
                  key={`late-${day}`}
                  className={`${
                    isMultiDay ? 'p-1.5 border-r last:border-r-0 border-slate-100 min-w-0' : 'flex-1 p-2'
                  } space-y-1.5`}
                >
                  {lateExams.map(renderExamCard)}
                  {lateTasks.map((t) => renderTaskCard(t, isMultiDay))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
