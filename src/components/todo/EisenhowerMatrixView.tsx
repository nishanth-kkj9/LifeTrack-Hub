import React from 'react';
import {
  AlertCircle,
  Flame,
  Calendar,
  Clock,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  Star,
  Plus,
} from 'lucide-react';
import { Task, TaskPriority } from '../../types/index.ts';
import { playTaskCompleteSound, triggerTaskConfetti } from '../../lib/todoUtils.ts';

interface EisenhowerMatrixViewProps {
  tasks: Task[];
  onUpdateTask: (task: Task) => void;
  onSelectTask: (task: Task) => void;
  onOpenQuickAddWithPriority: (priority: TaskPriority) => void;
}

export const EisenhowerMatrixView: React.FC<EisenhowerMatrixViewProps> = ({
  tasks,
  onUpdateTask,
  onSelectTask,
  onOpenQuickAddWithPriority,
}) => {
  const activeTasks = tasks.filter((t) => !t.completed);

  // Classify active tasks into 4 quadrants
  const q1Tasks = activeTasks.filter((t) => t.priority === 'urgent');
  const q2Tasks = activeTasks.filter((t) => t.priority === 'high');
  const q3Tasks = activeTasks.filter((t) => t.priority === 'medium');
  const q4Tasks = activeTasks.filter((t) => t.priority === 'low');

  const handleToggleComplete = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    playTaskCompleteSound();
    triggerTaskConfetti();
    onUpdateTask({
      ...task,
      completed: true,
      completedAt: Date.now(),
      status: 'done',
    });
  };

  const handleMoveQuadrant = (task: Task, targetPriority: TaskPriority, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateTask({
      ...task,
      priority: targetPriority,
    });
  };

  const renderQuadrant = (
    quadrantNumber: string,
    title: string,
    subtitle: string,
    actionAdvice: string,
    priority: TaskPriority,
    quadrantTasks: Task[],
    headerTheme: { bg: string; border: string; text: string; badge: string; pill: string }
  ) => {
    return (
      <div className={`flex flex-col bg-white rounded-3xl p-4 sm:p-5 border ${headerTheme.border} shadow-xs min-h-[380px]`}>
        {/* Quadrant Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${headerTheme.pill}`}>
                {quadrantNumber}
              </span>
              <h3 className={`text-sm font-black text-slate-900`}>{title}</h3>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">{subtitle}</p>
          </div>

          <div className="flex items-center gap-1.5">
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${headerTheme.badge}`}>
              {quadrantTasks.length}
            </span>
            <button
              onClick={() => onOpenQuickAddWithPriority(priority)}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              title={`Add task to ${title}`}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Strategy Banner */}
        <div className="my-2.5 px-3 py-1.5 rounded-xl bg-slate-50 text-[11px] text-slate-600 font-medium flex items-center justify-between">
          <span>Action: <strong className="text-slate-900">{actionAdvice}</strong></span>
          <span className="text-[10px] text-slate-400">P{priority === 'urgent' ? 1 : priority === 'high' ? 2 : priority === 'medium' ? 3 : 4}</span>
        </div>

        {/* Quadrant Tasks List */}
        <div className="flex-1 space-y-2 overflow-y-auto max-h-[320px] pr-0.5">
          {quadrantTasks.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 italic">
              No tasks in this quadrant.
            </div>
          ) : (
            quadrantTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => onSelectTask(task)}
                className="group bg-white p-3 rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-2xs transition flex items-start gap-2.5 cursor-pointer"
              >
                <button
                  onClick={(e) => handleToggleComplete(task, e)}
                  className="mt-0.5 text-slate-400 hover:text-emerald-600 transition cursor-pointer shrink-0"
                >
                  <Circle className="w-4 h-4" />
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-xs text-slate-900 truncate">
                      {task.title}
                    </span>
                    {task.isStarred && (
                      <Star className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" />
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                    <span className="font-medium text-slate-600">{task.dueDate}</span>
                    <span className="capitalize">{task.category}</span>
                    {task.subtasks.length > 0 && (
                      <span>
                        {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length} steps
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick move priority dropdown on hover */}
                <select
                  value={task.priority}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => handleMoveQuadrant(task, e.target.value as TaskPriority, e as any)}
                  className="text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 text-slate-600 focus:outline-hidden opacity-80 group-hover:opacity-100"
                >
                  <option value="urgent">Q1 (Do)</option>
                  <option value="high">Q2 (Plan)</option>
                  <option value="medium">Q3 (Delegate)</option>
                  <option value="low">Q4 (Drop)</option>
                </select>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Q1: Urgent & Important */}
        {renderQuadrant(
          'Q1',
          'Urgent & Important',
          'Immediate deadlines & critical priorities',
          'Do It Now',
          'urgent',
          q1Tasks,
          {
            bg: 'bg-rose-50/50',
            border: 'border-rose-200',
            text: 'text-rose-900',
            badge: 'bg-rose-100 text-rose-800',
            pill: 'bg-rose-600 text-white',
          }
        )}

        {/* Q2: Not Urgent & Important */}
        {renderQuadrant(
          'Q2',
          'Not Urgent & Important',
          'Long-term study, goals & compounding skills',
          'Schedule Time',
          'high',
          q2Tasks,
          {
            bg: 'bg-indigo-50/50',
            border: 'border-indigo-200',
            text: 'text-indigo-900',
            badge: 'bg-indigo-100 text-indigo-800',
            pill: 'bg-indigo-600 text-white',
          }
        )}

        {/* Q3: Urgent & Not Important */}
        {renderQuadrant(
          'Q3',
          'Urgent & Not Important',
          'Interruptions, quick chores, minor requests',
          'Delegate / Fast-Track',
          'medium',
          q3Tasks,
          {
            bg: 'bg-amber-50/50',
            border: 'border-amber-200',
            text: 'text-amber-900',
            badge: 'bg-amber-100 text-amber-800',
            pill: 'bg-amber-500 text-slate-950',
          }
        )}

        {/* Q4: Not Urgent & Not Important */}
        {renderQuadrant(
          'Q4',
          'Neither (Low Value)',
          'Distractions, low impact backlog, nice-to-haves',
          'Eliminate / Backlog',
          'low',
          q4Tasks,
          {
            bg: 'bg-slate-50/50',
            border: 'border-slate-200',
            text: 'text-slate-900',
            badge: 'bg-slate-100 text-slate-700',
            pill: 'bg-slate-700 text-white',
          }
        )}
      </div>
    </div>
  );
};
