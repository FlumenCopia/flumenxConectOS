import React, { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leadingIcon?: LucideIcon;
  trailingIcon?: LucideIcon;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, leadingIcon: LeadingIcon, trailingIcon: TrailingIcon, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-sage-800">
            {label}
          </label>
        )}
        <div className="relative rounded-lg shadow-soft-xs">
          {LeadingIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-sage-400">
              <LeadingIcon className="h-4 w-4" />
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              'w-full py-2 text-xs rounded-lg border bg-white text-sage-900 placeholder:text-sage-400 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700',
              LeadingIcon ? 'pl-9' : 'pl-3',
              TrailingIcon ? 'pr-9' : 'pr-3',
              error
                ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20'
                : 'border-sage-200 hover:border-sage-300',
              className
            )}
            {...props}
          />
          {TrailingIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-sage-400">
              <TrailingIcon className="h-4 w-4" />
            </div>
          )}
        </div>
        {error && <p className="text-[11px] text-rose-600 font-medium">{error}</p>}
        {helperText && !error && <p className="text-[11px] text-sage-500">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
