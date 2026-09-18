import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'brand';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, children, disabled, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none rounded-lg select-none';

    const variants = {
      primary: 'bg-brand-800 hover:bg-brand-700 text-white shadow-soft-xs active:translate-y-[0.5px]',
      brand: 'bg-brand-800 hover:bg-brand-700 text-white shadow-soft-xs active:translate-y-[0.5px]',
      secondary: 'bg-white hover:bg-sage-50 text-sage-800 border border-sage-200 shadow-soft-xs',
      outline: 'border border-sage-300 hover:bg-sage-50 text-sage-800 hover:border-sage-400',
      ghost: 'hover:bg-sage-100 text-sage-700 hover:text-sage-900',
      danger: 'bg-red-600 hover:bg-red-700 text-white shadow-soft-xs',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs gap-1.5',
      md: 'h-9 px-3.5 text-xs font-medium gap-2',
      lg: 'h-11 px-5 text-sm font-semibold gap-2.5',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

