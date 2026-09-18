import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand' | 'outline' | 'purple' | 'teal';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'neutral',
  size = 'sm',
  children,
  ...props
}) => {
  const variants = {
    brand: 'bg-brand-50 text-brand-800 border-brand-200/80',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
    warning: 'bg-amber-50 text-amber-800 border-amber-200/80',
    danger: 'bg-rose-50 text-rose-800 border-rose-200/80',
    info: 'bg-blue-50 text-blue-800 border-blue-200/80',
    teal: 'bg-teal-50 text-teal-800 border-teal-200/80',
    purple: 'bg-purple-50 text-purple-800 border-purple-200/80',
    neutral: 'bg-sage-100/80 text-sage-800 border-sage-200/80',
    outline: 'bg-transparent text-sage-700 border-sage-300',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[11px]',
    md: 'px-2.5 py-1 text-xs',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium rounded-md border tracking-wide select-none',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

