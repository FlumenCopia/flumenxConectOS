import React from 'react';
import { cn } from '@/lib/utils';
import { Flame, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export interface StatusBadgeProps {
  type?: 'stage' | 'priority' | 'score' | 'status';
  value: string;
  score?: number;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  type = 'stage',
  value,
  score,
  className,
}) => {
  const norm = value?.toLowerCase() || '';

  if (type === 'stage') {
    switch (norm) {
      case 'new':
        return (
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80', className)}>
            New
          </span>
        );
      case 'contacted':
        return (
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200/80', className)}>
            Contacted
          </span>
        );
      case 'qualified':
        return (
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80', className)}>
            Qualified
          </span>
        );
      case 'proposal':
        return (
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/80', className)}>
            Proposal
          </span>
        );
      case 'won':
        return (
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300', className)}>
            Won
          </span>
        );
      case 'lost':
        return (
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/80', className)}>
            Lost
          </span>
        );
      default:
        return (
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sage-100 text-sage-700 border border-sage-200', className)}>
            {value}
          </span>
        );
    }
  }

  if (type === 'priority') {
    switch (norm) {
      case 'urgent':
      case 'high':
        return (
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200', className)}>
            High
          </span>
        );
      case 'medium':
        return (
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200', className)}>
            Medium
          </span>
        );
      case 'low':
      default:
        return (
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200', className)}>
            Low
          </span>
        );
    }
  }

  if (type === 'score') {
    const num = score ?? parseInt(norm, 10) ?? 0;
    if (norm === 'hot' || num >= 75) {
      return (
        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80', className)}>
          <Flame className="w-3 h-3 text-emerald-600 fill-emerald-600" />
          <span>{num > 0 ? num : 'Hot'}</span>
        </span>
      );
    }
    if (norm === 'warm' || num >= 40) {
      return (
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80', className)}>
          <span>{num > 0 ? num : 'Warm'}</span>
        </span>
      );
    }
    return (
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-sage-100 text-sage-600 border border-sage-200', className)}>
        <span>{num > 0 ? num : 'Cold'}</span>
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-sage-100 text-sage-700 border border-sage-200', className)}>
      {value}
    </span>
  );
};
