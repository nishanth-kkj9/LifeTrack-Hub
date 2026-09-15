import React from 'react';
import {
  Plus,
  CheckCircle2,
  Circle,
  Calendar,
  Clock,
  Tag,
  AlertCircle,
  Star,
  MoreHorizontal,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Play,
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority } from '../../types/index.ts';
import { playTaskCompleteSound, triggerTaskConfetti } from '../../lib/todoUtils.ts';

interface KanbanBoardViewProps {
  tasks: Task[];
  onUpdateTask: (task: Task) => void;
  onSelectTask: (task: Task) => void;
  onOpenQuickAddWithStatus: (status: TaskStatus) => void;
  onStartFocus: (task: Task) => void;
}

const COLUMNS: Array<{ key: TaskStatus; title: string; color: string; badge: string }> = [
  { key: 'todo', title: 'To Do', color: 'border-slate-300 bg-slate-50/50', badge: 'bg-slate-200 text-slate-700' },
  { key: 'in_progress', title: 'In Progress', color: 'border-amber-300 bg-amber-50/20', badge: 'bg-amber-100 text-amber-800' },
  { key: 'in_review', title: 'In Review / Waiting', color: 'border-sky-300 bg-sky-50/20', badge: 'bg-sky-100 text-sky-800' },
  { key: 'done', title: 'Completed', color: 'border-emerald-300 bg-emerald-50/20', badge: 'bg-emerald-100 text-emerald-800' },
];

export const KanbanBoardView: React.FC<KanbanBoardViewProps> = ({
  tasks,
  onUpdateTask,
  onSelectTask,
  onOpenQuickAddWithStatus,
  onStartFocus,
}) => {
  const getTasksByStatus = (status: TaskStatus) => {
    return tasks.filter((t) => {
      const taskStatus = t.status || (t.completed ? 'done' : 'todo');
      return taskStatus === status;
    });
  };

  const handleMoveStatus = (task: Task, nextStatus: TaskStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    const isCompleted = nextStatus === 'done';
    if (isCompleted && !task.completed) {
      playTaskCompleteSound();
      triggerTaskConfetti();
    }
    onUpdateTask({
      ...task,
      status: nextStatus,
      completed: isCompleted,
      completedAt: isCompleted ? Date.now() : undefined,
    });
  };

  const getPriorityBorder = (p: TaskPriority) => {
    switch (p) {
      case 'urgent':
        return 'border-l-4 border-l-rose-500';
      case 'high':
        return 'border-l-4 border-l-amber-500';
      case 'medium':
        return 'border-l-4 border-l-indigo-500';
      case 'low':
        return 'border-l-4 border-l-slate-300';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start pb-8">
      {COLUMNS.map((col) => {
        const columnTasks = getTasksByStatus(col.key);

        return (
          <div
            key={col.key}
            className="flex flex-col bg-slate-50/70 rounded-3xl p-3.5 border border-slate-200/80 min-h-[480px]"
          >
            {/* Column Header */}
            <div className="flex items-center justify-between pb-3 px-1">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  {col.title}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${col.badge}`}>
                  {columnTasks.length}
                </span>
              </div>

              <button
                onClick={() => onOpenQuickAddWithStatus(col.key)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-white transition cursor-pointer"
                title={`Add task to ${col.title}`}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Task Cards Column Body */}
            <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[680px] pr-0.5">
              {columnTasks.length === 0 ? (
                <div className="py-12 px-4 text-center border border-dashed border-slate-200 rounded-2xl">
                  <p className="text-xs text-slate-400 font-medium">No tasks here</p>
                  <button
                    onClick={() => onOpenQuickAddWithStatus(col.key)}
                    className="mt-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-700"
                  >
                    + Add to {col.title}
                  </button>
                </div>
              ) : (
                columnTasks.map((task) => {
                  const completedSubtasks = task.subtasks.filter((s) => s.completed).length;
                  const totalSubtasks = task.subtasks.length;

                  return (
                    <div
                      key={task.id}
                      onClick={() => onSelectTask(task)}
                      className={`bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all cursor-pointer space-y-2.5 ${getPriorityBorder(
                        task.priority
                      )}`}
                    >
                      {/* Top row: Title and Star */}
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`font-bold text-xs sm:text-sm text-slate-900 leading-snug ${
                            task.completed ? 'line-through text-slate-400' : ''
                          }`}
                        >
                          {task.title}
                        </span>
                        {task.isStarred && (
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0 mt-0.5" />
                        )}
                      </div>

                      {/* Description snippet if any */}
                      {task.description && (
                        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                          {task.description}
                        </p>
                      )}

                      {/* Subtasks Progress */}
                      {totalSubtasks > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                            <span>Checklist</span>
                            <span>
                              {completedSubtasks}/{totalSubtasks}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-indigo-600 h-full rounded-full"
                              style={{
                                width: `${Math.round((completedSubtasks / totalSubtasks) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Metadata Chips Strip */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px]">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{task.dueDate.slice(5)}</span>
                        </span>

                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium capitalize">
                          {task.category}
                        </span>

                        {task.estimatedMinutes && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">
                            <Clock className="w-2.5 h-2.5" />
                            <span>{task.estimatedMinutes}m</span>
                          </span>
                        )}
                      </div>

                      {/* Bottom Controls / Quick Move Buttons */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onStartFocus(task);
                          }}
                          className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center gap-1 transition"
                          title="Start focus timer"
                        >
                          <Play className="w-2.5 h-2.5 fill-indigo-700" />
                          <span>Focus</span>
                        </button>

                        <div className="flex items-center gap-1">
                          {col.key !== 'todo' && (
                            <button
                              onClick={(e) => {
                                const prev =
                                  col.key === 'done'
                                    ? 'in_review'
                                    : col.key === 'in_review'
                                    ? 'in_progress'
                                    : 'todo';
                                handleMoveStatus(task, prev, e);
                              }}
                              className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] transition"
                              title="Move left"
                            >
                              <ArrowLeft className="w-3 h-3" />
                            </button>
                          )}

                          {col.key !== 'done' && (
                            <button
                              onClick={(e) => {
                                const next =
                                  col.key === 'todo'
                                    ? 'in_progress'
                                    : col.key === 'in_progress'
                                    ? 'in_review'
                                    : 'done';
                                handleMoveStatus(task, next, e);
                              }}
                              className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold transition flex items-center gap-1"
                              title="Advance status"
                            >
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
