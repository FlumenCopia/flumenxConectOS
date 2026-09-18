import React, { SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, children, id, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-semibold text-sage-800">
            {label}
          </label>
        )}
        <div className="relative rounded-lg shadow-soft-xs">
          <select
            id={selectId}
            ref={ref}
            className={cn(
              'w-full appearance-none pl-3 pr-8 py-2 text-xs rounded-lg border bg-white text-sage-900 transition-colors cursor-pointer',
              'focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700',
              error
                ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20'
                : 'border-sage-200 hover:border-sage-300',
              className
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-sage-400 pointer-events-none" />
        </div>
        {error && <p className="text-[11px] text-rose-600 font-medium">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
