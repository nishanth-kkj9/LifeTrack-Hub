import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  dot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  dot = false,
  className = '',
}) => {
  const dotColors = {
    neutral: 'bg-slate-400',
    success: 'bg-emerald-600',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
    info: 'bg-blue-500',
  };

  const textColors = {
    neutral: 'text-slate-600',
    success: 'text-emerald-700 font-medium',
    warning: 'text-amber-700 font-medium',
    danger: 'text-rose-700 font-medium',
    info: 'text-blue-700 font-medium',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${textColors[variant]} ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]} shrink-0`} aria-hidden="true" />}
      <span>{children}</span>
    </span>
  );
};
