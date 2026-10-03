import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'subtle' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'secondary',
      size = 'md',
      icon,
      iconPosition = 'left',
      isLoading = false,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const baseClasses =
      'inline-flex items-center justify-center font-semibold transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none cursor-pointer whitespace-nowrap min-h-[36px]';

    const sizeClasses = {
      sm: 'text-xs px-3 py-1.5 rounded-lg gap-1.5 min-h-[36px]',
      md: 'text-sm px-4 py-2 rounded-xl gap-2 min-h-[40px]',
      lg: 'text-base px-5 py-2.5 rounded-xl gap-2.5 min-h-[44px]',
    };

    const variantClasses = {
      primary: 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs',
      secondary: 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs',
      subtle: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
      danger: 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200',
      ghost: 'bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900',
      outline: 'bg-transparent border border-slate-300 hover:bg-slate-50 text-slate-700',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {!isLoading && icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>}
        <span>{children}</span>
        {!isLoading && icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
