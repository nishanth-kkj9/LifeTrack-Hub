import React from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  kicker?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  kicker,
  actions,
  children,
  className = '',
}) => {
  return (
    <div className={`mb-6 sm:mb-8 ${className}`}>
      {kicker && (
        <span className="text-xs font-semibold text-emerald-800 tracking-wider uppercase mb-1 block">
          {kicker}
        </span>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-slate-500 leading-normal max-w-2xl text-balance">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2.5 shrink-0">{actions}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
};
