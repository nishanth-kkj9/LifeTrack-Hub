import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Star,
  Plus,
  GripVertical,
} from 'lucide-react';
import { Task } from '../../types/index.ts';
import { playTaskCompleteSound, triggerTaskConfetti } from '../../lib/todoUtils.ts';
import { completeTask, reopenTask } from '../../lib/taskActions.ts';
import { isOverdue } from '../../lib/taskUtils.ts';
import {
  MatrixQuadrant,
  classifyMatrixTask,
  moveTaskToQuadrant,
} from '../../lib/matrixUtils.ts';

interface EisenhowerMatrixViewProps {
  tasks: Task[];
  onUpdateTask: (task: Task, nextTask?: Task) => void;
  onSelectTask: (task: Task) => void;
  onOpenQuickAddForQuadrant: (quadrant: MatrixQuadrant) => void;
}

export const EisenhowerMatrixView: React.FC<EisenhowerMatrixViewProps> = ({
  tasks,
  onUpdateTask,
  onSelectTask,
  onOpenQuickAddForQuadrant,
}) => {
  const [now, setNow] = useState(() => new Date());
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverQuadrant, setDragOverQuadrant] = useState<MatrixQuadrant | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Derive real Urgent (due within 2 days or overdue) and Important (priority urgent/high or starred) fields
  const classifiedTasks = useMemo(
    () =>
      tasks.map((task) => ({
        task,
        ...classifyMatrixTask(task, now),
        overdue: isOverdue(task, now),
      })),
    [tasks, now]
  );

  const q1Tasks = classifiedTasks.filter((item) => item.quadrant === 'q1');
  const q2Tasks = classifiedTasks.filter((item) => item.quadrant === 'q2');
  const q3Tasks = classifiedTasks.filter((item) => item.quadrant === 'q3');
  const q4Tasks = classifiedTasks.filter((item) => item.quadrant === 'q4');

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

  const handleMoveQuadrant = (task: Task, targetQuadrant: MatrixQuadrant) => {
    const updated = moveTaskToQuadrant(task, targetQuadrant, now);
    onUpdateTask(updated);
  };

  const handleDropOnQuadrant = (targetQuadrant: MatrixQuadrant, e: React.DragEvent) => {
    e.preventDefault();
    const droppedId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    setDragOverQuadrant(null);
    setDraggedTaskId(null);
    if (!droppedId) return;
    const task = tasks.find((t) => t.id === droppedId);
    if (!task) return;
    handleMoveQuadrant(task, targetQuadrant);
  };

  const renderQuadrant = (
    quadrantKey: MatrixQuadrant,
    quadrantNumber: string,
    title: string,
    subtitle: string,
    actionAdvice: string,
    axisCriteria: string,
    quadrantItems: typeof classifiedTasks,
    headerTheme: { bg: string; border: string; text: string; badge: string; pill: string; ring: string }
  ) => {
    const isDropTarget = dragOverQuadrant === quadrantKey;

    return (
      <div
        data-quadrant={quadrantKey}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (dragOverQuadrant !== quadrantKey) {
            setDragOverQuadrant(quadrantKey);
          }
        }}
        onDragLeave={() => {
          if (dragOverQuadrant === quadrantKey) {
            setDragOverQuadrant(null);
          }
        }}
        onDrop={(e) => handleDropOnQuadrant(quadrantKey, e)}
        className={`flex flex-col bg-white rounded-3xl p-4 sm:p-5 border transition-all shadow-xs min-h-[380px] ${
          isDropTarget ? `ring-2 ${headerTheme.ring} border-transparent bg-slate-50/40` : headerTheme.border
        }`}
      >
        {/* Quadrant Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${headerTheme.pill}`}>
                {quadrantNumber}
              </span>
              <h3 className="text-sm font-black text-slate-900">{title}</h3>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">{subtitle}</p>
          </div>

          <div className="flex items-center gap-1.5">
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${headerTheme.badge}`}>
              {quadrantItems.length}
            </span>
            <button
              type="button"
              onClick={() => onOpenQuickAddForQuadrant(quadrantKey)}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              title={`Add task to ${title}`}
              aria-label={`Add task to ${title}`}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Strategy Banner */}
        <div className="my-2.5 px-3 py-1.5 rounded-xl bg-slate-50 text-[11px] text-slate-600 font-medium flex items-center justify-between gap-2">
          <span>
            Action: <strong className="text-slate-900">{actionAdvice}</strong>
          </span>
          <span className="text-[10px] text-slate-500 font-semibold">{axisCriteria}</span>
        </div>

        {/* Quadrant Tasks List */}
        <div className="flex-1 space-y-2 overflow-y-auto max-h-[320px] pr-0.5">
          {quadrantItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 italic border border-dashed border-slate-200 rounded-2xl">
              Drag a task here or add one for this quadrant.
            </div>
          ) : (
            quadrantItems.map(({ task, urgent, important, overdue }) => (
              <div
                key={task.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', task.id);
                  e.dataTransfer.effectAllowed = 'move';
                  setDraggedTaskId(task.id);
                }}
                onDragEnd={() => {
                  setDraggedTaskId(null);
                  setDragOverQuadrant(null);
                }}
                onClick={() => onSelectTask(task)}
                className={`group bg-white p-3 rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-2xs transition flex items-start gap-2 cursor-pointer ${
                  draggedTaskId === task.id ? 'opacity-50' : ''
                }`}
              >
                <span
                  className="mt-0.5 text-slate-300 group-hover:text-slate-500 cursor-grab shrink-0"
                  title="Drag to another quadrant"
                >
                  <GripVertical className="w-3.5 h-3.5" />
                </span>

                <button
                  type="button"
                  onClick={(e) => handleToggleComplete(task, e)}
                  className="mt-0.5 text-slate-400 hover:text-emerald-600 transition cursor-pointer shrink-0"
                  title={task.completed ? 'Mark incomplete' : 'Mark complete'}
                  aria-label={task.completed ? `Reopen ${task.title}` : `Complete ${task.title}`}
                >
                  {task.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 fill-emerald-50" />
                  ) : (
                    <Circle className="w-4 h-4" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`font-bold text-xs truncate ${
                        task.completed ? 'line-through text-slate-400' : 'text-slate-900'
                      }`}
                    >
                      {task.title}
                    </span>
                    {task.isStarred && (
                      <Star className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" />
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 mt-1">
                    {task.dueDate && (
                      <span
                        className={`font-medium ${
                          overdue ? 'text-rose-600 font-bold' : urgent ? 'text-amber-700 font-semibold' : 'text-slate-600'
                        }`}
                      >
                        {task.dueDate}
                      </span>
                    )}
                    <span className="capitalize px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                      {task.priority}
                    </span>
                    {overdue && (
                      <span className="px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 font-bold">
                        Overdue
                      </span>
                    )}
                    {!overdue && urgent && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 font-semibold">
                        Due ≤2d
                      </span>
                    )}
                    {important && (
                      <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-semibold">
                        Important
                      </span>
                    )}
                    {task.subtasks.length > 0 && (
                      <span>
                        {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length} steps
                      </span>
                    )}
                  </div>
                </div>

                {/* Accessible quadrant switcher updating dueDate/priority explicitly */}
                <select
                  aria-label={`Move ${task.title} to quadrant`}
                  value={quadrantKey}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    e.stopPropagation();
                    handleMoveQuadrant(task, e.target.value as MatrixQuadrant);
                  }}
                  className="text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 text-slate-600 focus:outline-hidden opacity-80 group-hover:opacity-100"
                >
                  <option value="q1">Q1 (Do)</option>
                  <option value="q2">Q2 (Schedule)</option>
                  <option value="q3">Q3 (Delegate)</option>
                  <option value="q4">Q4 (Drop)</option>
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
          'q1',
          'Q1',
          'Urgent & Important',
          'Due within 2 days or overdue + High/Urgent/Starred',
          'Do It Now',
          'Urgent • Important',
          q1Tasks,
          {
            bg: 'bg-rose-50/50',
            border: 'border-rose-200',
            text: 'text-rose-900',
            badge: 'bg-rose-100 text-rose-800',
            pill: 'bg-rose-600 text-white',
            ring: 'ring-rose-400',
          }
        )}

        {/* Q2: Not Urgent & Important */}
        {renderQuadrant(
          'q2',
          'Q2',
          'Not Urgent & Important',
          'Due >2 days out + High/Urgent/Starred',
          'Schedule Time',
          'Not Urgent • Important',
          q2Tasks,
          {
            bg: 'bg-indigo-50/50',
            border: 'border-indigo-200',
            text: 'text-indigo-900',
            badge: 'bg-indigo-100 text-indigo-800',
            pill: 'bg-indigo-600 text-white',
            ring: 'ring-indigo-400',
          }
        )}

        {/* Q3: Urgent & Not Important */}
        {renderQuadrant(
          'q3',
          'Q3',
          'Urgent & Not Important',
          'Due within 2 days or overdue + Medium/Low',
          'Delegate / Fast-Track',
          'Urgent • Not Important',
          q3Tasks,
          {
            bg: 'bg-amber-50/50',
            border: 'border-amber-200',
            text: 'text-amber-900',
            badge: 'bg-amber-100 text-amber-800',
            pill: 'bg-amber-500 text-slate-950',
            ring: 'ring-amber-400',
          }
        )}

        {/* Q4: Not Urgent & Not Important */}
        {renderQuadrant(
          'q4',
          'Q4',
          'Neither (Low Value)',
          'Due >2 days out + Medium/Low priority',
          'Eliminate / Backlog',
          'Not Urgent • Not Important',
          q4Tasks,
          {
            bg: 'bg-slate-50/50',
            border: 'border-slate-200',
            text: 'text-slate-900',
            badge: 'bg-slate-100 text-slate-700',
            pill: 'bg-slate-700 text-white',
            ring: 'ring-slate-400',
          }
        )}
      </div>
    </div>
  );
};
