import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'earth' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  retryAfterSeconds?: number;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      retryAfterSeconds,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const isRateLimited = Boolean(retryAfterSeconds && retryAfterSeconds > 0);
    const isDisabled = disabled || isLoading || isRateLimited;

    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none';

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-xs gap-1.5',
      md: 'px-4 py-2.5 text-sm gap-2',
      lg: 'px-6 py-3.5 text-base gap-2.5 font-semibold',
    }[size];

    const variantStyles = {
      primary:
        'bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white shadow-soft focus:ring-brand-500',
      secondary:
        'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-200 shadow-sm focus:ring-slate-300',
      accent:
        'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-soft focus:ring-amber-500',
      earth:
        'bg-earth-600 hover:bg-earth-700 active:bg-earth-800 text-white shadow-soft focus:ring-earth-500',
      danger:
        'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-soft focus:ring-rose-500',
      outline:
        'bg-transparent hover:bg-brand-50 text-brand-700 border border-brand-300 focus:ring-brand-500',
      ghost:
        'bg-transparent hover:bg-slate-100 active:bg-slate-200 text-slate-700 focus:ring-slate-300',
    }[variant];

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        {isRateLimited ? `Please wait (${retryAfterSeconds}s)` : children}
      </button>
    );
  }
);

Button.displayName = 'Button';
