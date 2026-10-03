import React from 'react';

export interface SectionHeaderProps {
  title: string;
  description?: string;
  badge?: string | number;
  action?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  badge,
  action,
  className = '',
}) => {
  return (
    <div className={`flex items-center justify-between gap-4 mb-3 ${className}`}>
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900 tracking-tight">{title}</h2>
          {badge !== undefined && (
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              ({badge})
            </span>
          )}
        </div>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};
