import React from 'react';
import { Card } from './Card.tsx';

export interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  onClick?: () => void;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  icon,
  trend,
  onClick,
  className = '',
}) => {
  return (
    <Card
      padding="md"
      className={`${onClick ? 'cursor-pointer hover:border-slate-300 hover:shadow-xs transition-all' : 'hover:border-slate-300 transition-colors'} ${className}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
      </div>
      <div className="mt-2.5 flex items-baseline gap-2">
        <span className="text-2xl font-black tracking-tight text-slate-900 tabular-nums">
          {value}
        </span>
        {trend && (
          <span
            className={`text-xs font-bold tabular-nums px-1.5 py-0.5 rounded-md ${
              trend.isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>
      {subtext && <p className="mt-1 text-xs text-slate-500 leading-normal font-medium">{subtext}</p>}
    </Card>
  );
};
