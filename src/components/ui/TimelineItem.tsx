import React from 'react';

export interface TimelineItemProps {
  time: string;
  title: string;
  subtitle?: string;
  type?: 'task' | 'exam' | 'habit' | 'focus';
  isPast?: boolean;
  isCurrent?: boolean;
  onClick?: () => void;
}

export const TimelineItem: React.FC<TimelineItemProps> = ({
  time,
  title,
  subtitle,
  type = 'task',
  isPast = false,
  isCurrent = false,
  onClick,
}) => {
  const dotColor = {
    task: 'bg-emerald-600',
    exam: 'bg-indigo-600',
    habit: 'bg-amber-500',
    focus: 'bg-purple-600',
  }[type];

  return (
    <div
      onClick={onClick}
      className={`group flex items-start gap-3 py-2 px-2.5 rounded-lg transition-colors ${
        onClick ? 'cursor-pointer hover:bg-slate-50' : ''
      } ${isPast ? 'opacity-50' : ''}`}
    >
      <span className="text-xs font-mono font-medium text-slate-500 w-12 shrink-0 tabular-nums pt-0.5">
        {time}
      </span>
      <div className="flex items-center gap-2 pt-1 shrink-0">
        <span
          className={`w-2 h-2 rounded-full ${dotColor} ${
            isCurrent ? 'ring-4 ring-emerald-100' : ''
          }`}
          aria-hidden="true"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`text-xs font-medium truncate ${
            isPast ? 'line-through text-slate-500' : 'text-slate-900'
          }`}
        >
          {title}
        </p>
        {subtitle && <p className="text-[11px] text-slate-400 truncate mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
};
