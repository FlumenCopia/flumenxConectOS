import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

export interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
  icon: LucideIcon;
  iconBgColor?: string;
  iconColor?: string;
  className?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  change,
  isPositive = true,
  icon: Icon,
  iconBgColor = 'bg-brand-50',
  iconColor = 'text-brand-800',
  className,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white border border-sage-200/90 rounded-xl p-5 shadow-soft-xs transition-all duration-200 hover:shadow-soft-md hover:border-sage-300 select-none',
        onClick ? 'cursor-pointer' : '',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-2xl font-bold tracking-tight text-sage-900">{value}</p>
          <p className="text-xs font-medium text-sage-500">{label}</p>
        </div>
        <div className={cn('p-2.5 rounded-xl border border-black/[0.04]', iconBgColor)}>
          <Icon className={cn('h-5 w-5', iconColor)} />
        </div>
      </div>

      {change && (
        <div className="mt-3 pt-3 border-t border-sage-100 flex items-center gap-1.5 text-xs">
          {isPositive ? (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>{change}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-semibold text-rose-600">
              <TrendingDown className="h-3.5 w-3.5" />
              <span>{change}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};
