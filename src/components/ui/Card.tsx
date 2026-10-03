import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  bordered?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  padding = 'md',
  bordered = true,
  className = '',
  ...props
}) => {
  const paddingClasses = {
    none: 'p-0',
    sm: 'p-3 sm:p-4',
    md: 'p-4 sm:p-5',
    lg: 'p-6 sm:p-8',
  };

  return (
    <div
      className={`bg-white rounded-xl ${
        bordered ? 'border border-slate-200/90' : ''
      } shadow-2xs ${paddingClasses[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
