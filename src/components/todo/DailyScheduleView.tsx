import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { Task } from '../../types/index.ts';
import { playTaskCompleteSound, triggerTaskConfetti } from '../../lib/todoUtils.ts';
import { getLocalDateString, parseLocalDate, getLocalDateOffset } from '../../lib/dateUtils.ts';
import { completeTask, reopenTask } from '../../lib/taskActions.ts';
import { TimeGrid } from '../common/TimeGrid.tsx';

interface DailyScheduleViewProps {
  tasks: Task[];
  onUpdateTask: (task: Task, nextTask?: Task) => void;
  onSelectTask: (task: Task) => void;
  onStartFocus: (task: Task) => void;
}

export const DailyScheduleView: React.FC<DailyScheduleViewProps> = ({
  tasks,
  onUpdateTask,
  onSelectTask,
  onStartFocus,
}) => {
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString());

  const todayStr = getLocalDateString();

  const handlePrevDay = () => {
    const d = parseLocalDate(selectedDate);
    setSelectedDate(getLocalDateOffset(-1, d));
  };

  const handleNextDay = () => {
    const d = parseLocalDate(selectedDate);
    setSelectedDate(getLocalDateOffset(1, d));
  };

  const handleToday = () => {
    setSelectedDate(todayStr);
  };

  const handleToggleComplete = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    if (task.completed) {
      onUpdateTask(reopenTask(task));
    } else {
      const { completed, nextTask } = completeTask(task);
      playTaskCompleteSound();
      triggerTaskConfetti();
      onUpdateTask(completed, nextTask);
    }
  };

  // Day's tasks
  const dayTasks = tasks.filter((t) => t.dueDate === selectedDate);
  const unscheduledTasks = dayTasks.filter((t) => !t.dueTime);

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
        <div className="lg:col-span-3">
          <TimeGrid
            days={[selectedDate]}
            tasks={dayTasks}
            onSelectTask={onSelectTask}
            onToggleTask={handleToggleComplete}
            onStartFocus={onStartFocus}
          />
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
