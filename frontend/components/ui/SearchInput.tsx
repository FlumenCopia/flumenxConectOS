import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Search, X } from 'lucide-react';

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
  showShortcut?: boolean;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, value, onChange, onClear, showShortcut = true, placeholder = 'Search leads, messages, tasks...', ...props }, ref) => {
    return (
      <div className={cn('relative flex items-center w-full', className)}>
        <Search className="absolute left-3.5 h-4 w-4 text-sage-400 pointer-events-none" />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full pl-9 pr-14 py-2 bg-sage-50/70 hover:bg-sage-50 focus:bg-white text-xs text-sage-900 placeholder:text-sage-400 rounded-lg border border-sage-200/90 focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition-all shadow-soft-xs"
          {...props}
        />
        {value && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-9 text-sage-400 hover:text-sage-600 p-0.5"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {showShortcut && !value && (
          <div className="absolute right-2.5 pointer-events-none flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-sage-200 bg-white text-[10px] font-medium text-sage-400 shadow-soft-xs">
            <span>⌘</span>
            <span>K</span>
          </div>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';
