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
      className={`${onClick ? 'cursor-pointer hover:border-slate-300 transition-colors' : ''} ${className}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
          {value}
        </span>
        {trend && (
          <span
            className={`text-xs font-medium tabular-nums ${
              trend.isPositive ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>
      {subtext && <p className="mt-1 text-xs text-slate-500 leading-normal">{subtext}</p>}
    </Card>
  );
};
