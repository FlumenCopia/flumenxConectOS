import React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export interface ToastProps {
  type?: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
  onClose?: () => void;
  className?: string;
}

export const Toast: React.FC<ToastProps> = ({
  type = 'success',
  title,
  description,
  onClose,
  className,
}) => {
  const icons = {
    success: <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />,
    error: <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />,
    info: <Info className="h-5 w-5 text-teal-600 shrink-0 mt-0.5" />,
  };

  return (
    <div
      className={cn(
        'bg-white border border-sage-200/90 rounded-xl p-3.5 shadow-soft-lg flex items-start gap-3 max-w-sm w-full select-none animate-in fade-in slide-in-from-top-2 duration-200',
        className
      )}
    >
      {icons[type]}
      <div className="flex-1 min-w-0 pr-1">
        <p className="text-xs font-bold text-sage-900 leading-tight">{title}</p>
        {description && (
          <p className="text-[11px] text-sage-500 mt-0.5 leading-snug">{description}</p>
        )}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="text-sage-400 hover:text-sage-600 p-0.5 rounded transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};
