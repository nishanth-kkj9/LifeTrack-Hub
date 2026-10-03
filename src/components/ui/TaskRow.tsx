import React from 'react';
import { Check, Clock, AlertCircle, Star } from 'lucide-react';
import { Task } from '../../types/index.ts';

export interface TaskRowProps {
  task: Task;
  onToggle: (taskId: string) => void;
  onClick?: (task: Task) => void;
  showCategory?: boolean;
  className?: string;
}

export const TaskRow: React.FC<TaskRowProps> = ({
  task,
  onToggle,
  onClick,
  showCategory = true,
  className = '',
}) => {
  const isUrgent = task.priority === 'urgent';
  const isHigh = task.priority === 'high';

  return (
    <div
      onClick={() => onClick?.(task)}
      className={`group flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/50 transition-all ${
        task.completed ? 'opacity-60 bg-slate-50/70' : ''
      } ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Checkbox button */}
        <button
          type="button"
          role="checkbox"
          aria-checked={task.completed}
          aria-label={task.completed ? `Mark "${task.title}" incomplete` : `Mark "${task.title}" complete`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(task.id);
          }}
          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 ${
            task.completed
              ? 'bg-emerald-600 border-emerald-600 text-white'
              : 'border-slate-300 hover:border-emerald-600 bg-white'
          }`}
        >
          {task.completed && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
        </button>

        {/* Task Title and Context */}
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-medium truncate ${
              task.completed ? 'line-through text-slate-400' : 'text-slate-900'
            }`}
          >
            {task.title}
          </p>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
            {task.dueTime && (
              <span className="flex items-center gap-1 font-mono text-[11px] tabular-nums">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>{task.dueTime}</span>
              </span>
            )}
            {task.estimatedMinutes && (
              <span className="tabular-nums font-mono text-[11px] text-slate-400">
                {task.estimatedMinutes}m
              </span>
            )}
            {showCategory && task.category && (
              <>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="capitalize">{task.category}</span>
              </>
            )}
            {task.tags && task.tags.length > 0 && (
              <>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="text-slate-400 truncate max-w-[120px]">
                  #{task.tags[0]}
                  {task.tags.length > 1 && ` +${task.tags.length - 1}`}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right side indicators */}
      <div className="flex items-center gap-2 shrink-0">
        {task.isStarred && (
          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" aria-label="Starred task" />
        )}
        {isUrgent && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            <span>Urgent</span>
          </span>
        )}
        {!isUrgent && isHigh && (
          <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
            High
          </span>
        )}
      </div>
    </div>
  );
};
