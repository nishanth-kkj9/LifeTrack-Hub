import React from 'react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  'aria-label': string;
  variant?: 'primary' | 'secondary' | 'subtle' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      'aria-label': ariaLabel,
      variant = 'ghost',
      size = 'md',
      className = '',
      title,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseClasses =
      'inline-flex items-center justify-center rounded-lg transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

    const sizeClasses = {
      sm: 'w-7 h-7 text-xs',
      md: 'w-9 h-9 text-sm',
      lg: 'w-10 h-10 text-base',
    };

    const variantClasses = {
      primary: 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs',
      secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs',
      subtle: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
      ghost: 'text-slate-500 hover:text-slate-900 hover:bg-slate-100',
      danger: 'text-rose-600 hover:text-rose-800 hover:bg-rose-50',
    };

    return (
      <button
        ref={ref}
        type="button"
        aria-label={ariaLabel}
        title={title || ariaLabel}
        disabled={disabled}
        className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
        {...props}
      >
        {icon}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
