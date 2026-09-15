import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle2,
  Circle,
  Play,
  Star,
  AlertCircle,
} from 'lucide-react';
import { Task, TaskPriority } from '../../types/index.ts';
import { playTaskCompleteSound, triggerTaskConfetti } from '../../lib/todoUtils.ts';

interface DailyScheduleViewProps {
  tasks: Task[];
  onUpdateTask: (task: Task) => void;
  onSelectTask: (task: Task) => void;
  onStartFocus: (task: Task) => void;
}

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7:00 AM to 10:00 PM

export const DailyScheduleView: React.FC<DailyScheduleViewProps> = ({
  tasks,
  onUpdateTask,
  onSelectTask,
  onStartFocus,
}) => {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  const todayStr = new Date().toISOString().split('T')[0];

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setSelectedDate(todayStr);
  };

  const handleToggleComplete = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    const isCompleted = !task.completed;
    if (isCompleted) {
      playTaskCompleteSound();
      triggerTaskConfetti();
    }
    onUpdateTask({
      ...task,
      completed: isCompleted,
      completedAt: isCompleted ? Date.now() : undefined,
      status: isCompleted ? 'done' : 'todo',
    });
  };

  // Day's tasks
  const dayTasks = tasks.filter((t) => t.dueDate === selectedDate);
  const scheduledTasks = dayTasks.filter((t) => !!t.dueTime);
  const unscheduledTasks = dayTasks.filter((t) => !t.dueTime);

  // Group tasks by hour (07 to 22)
  const getTasksForHour = (hour: number) => {
    return scheduledTasks.filter((t) => {
      if (!t.dueTime) return false;
      const h = parseInt(t.dueTime.split(':')[0], 10);
      return h === hour;
    });
  };

  const formatHourLabel = (hour: number) => {
    const meridian = hour >= 12 ? 'PM' : 'AM';
    const h = hour % 12 === 0 ? 12 : hour % 12;
    return `${h}:00 ${meridian}`;
  };

  const isSelectedToday = selectedDate === todayStr;

  return (
    <div className="space-y-4 pb-8">
      {/* Schedule Header / Date Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevDay}
            className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleNextDay}
            className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={handleToday}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
              isSelectedToday
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Today
          </button>

          <span className="text-sm font-black text-slate-900 ml-2">
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <span>{dayTasks.length} tasks planned for this day</span>
        </div>
      </div>

      {/* Main Grid: Timeline + Unscheduled Side Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
        {/* Left 3 cols: Hour-by-hour Timeline */}
        <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden divide-y divide-slate-100">
          {HOURS.map((hour) => {
            const hourTasks = getTasksForHour(hour);

            return (
              <div key={hour} className="flex items-start min-h-[68px] hover:bg-slate-50/50 transition">
                {/* Hour Label */}
                <div className="w-24 sm:w-28 p-3 text-[11px] font-mono font-bold text-slate-400 border-r border-slate-100 shrink-0 text-right pr-4">
                  {formatHourLabel(hour)}
                </div>

                {/* Hour Content */}
                <div className="flex-1 p-2 space-y-1.5">
                  {hourTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => onSelectTask(task)}
                      className={`p-2.5 rounded-2xl border transition flex items-center justify-between gap-3 cursor-pointer ${
                        task.completed
                          ? 'bg-slate-50 border-slate-200 opacity-60'
                          : task.priority === 'urgent'
                          ? 'bg-rose-50/80 border-rose-200'
                          : task.priority === 'high'
                          ? 'bg-amber-50/80 border-amber-200'
                          : 'bg-indigo-50/70 border-indigo-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <button
                          onClick={(e) => handleToggleComplete(task, e)}
                          className="text-slate-400 hover:text-emerald-600 transition cursor-pointer shrink-0"
                        >
                          {task.completed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 fill-emerald-100" />
                          ) : (
                            <Circle className="w-4 h-4" />
                          )}
                        </button>
                        <span
                          className={`font-bold text-xs truncate ${
                            task.completed ? 'line-through text-slate-400' : 'text-slate-900'
                          }`}
                        >
                          {task.title}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/80 border border-slate-200/60 text-slate-600">
                          {task.dueTime}
                        </span>
                        {task.estimatedMinutes && (
                          <span className="text-[10px] text-slate-400 hidden sm:inline font-mono">
                            ~{task.estimatedMinutes}m
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onStartFocus(task);
                          }}
                          className="px-2 py-1 rounded-lg bg-white/80 hover:bg-white text-indigo-700 text-[10px] font-bold border border-indigo-200/60 transition flex items-center gap-1"
                        >
                          <Play className="w-2.5 h-2.5 fill-indigo-700" />
                          <span>Focus</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right 1 col: Unscheduled Day Tasks Tray */}
        <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
              Unscheduled ({unscheduledTasks.length})
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">All day</span>
          </div>

          <p className="text-[11px] text-slate-400">
            Tasks for this day without a specific hour. Click any task to assign a time slot.
          </p>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-0.5">
            {unscheduledTasks.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 italic border border-dashed border-slate-200 rounded-2xl">
                All tasks are scheduled!
              </div>
            ) : (
              unscheduledTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  className="p-3 bg-slate-50 hover:bg-white rounded-2xl border border-slate-200 hover:border-slate-300 transition cursor-pointer space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`font-bold text-xs text-slate-900 ${
                        task.completed ? 'line-through text-slate-400' : ''
                      }`}
                    >
                      {task.title}
                    </span>
                    <button
                      onClick={(e) => handleToggleComplete(task, e)}
                      className="text-slate-400 hover:text-emerald-600 transition shrink-0"
                    >
                      {task.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <span className="capitalize">{task.category}</span>
                    <span>•</span>
                    <span className="font-mono">~{task.estimatedMinutes || 25}m</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
