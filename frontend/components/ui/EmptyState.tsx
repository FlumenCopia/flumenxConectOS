import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}) => {
  return (
    <div className={cn('py-12 px-4 text-center flex flex-col items-center justify-center select-none', className)}>
      <div className="h-12 w-12 rounded-2xl bg-sage-100/80 border border-sage-200/80 flex items-center justify-center text-sage-600 mb-3 shadow-soft-xs">
        <Icon className="h-6 w-6 stroke-[1.75]" />
      </div>
      <h4 className="text-sm font-bold text-sage-900">{title}</h4>
      <p className="text-xs text-sage-500 max-w-sm mt-1 mb-4 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <Button size="sm" variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
