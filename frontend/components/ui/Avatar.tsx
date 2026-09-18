import React from 'react';
import { cn } from '@/lib/utils';

export interface AvatarProps {
  name?: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  name = 'User',
  src,
  size = 'md',
  className,
}) => {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U';

  const sizes = {
    xs: 'h-6 w-6 text-[10px]',
    sm: 'h-7 w-7 text-xs',
    md: 'h-8 w-8 text-xs',
    lg: 'h-10 w-10 text-sm font-semibold',
  };

  // Deterministic soft background based on name
  const bgColors = [
    'bg-brand-100 text-brand-800 border-brand-200',
    'bg-emerald-100 text-emerald-800 border-emerald-200',
    'bg-teal-100 text-teal-800 border-teal-200',
    'bg-amber-100 text-amber-800 border-amber-200',
    'bg-sky-100 text-sky-800 border-sky-200',
    'bg-purple-100 text-purple-800 border-purple-200',
  ];
  const charCodeSum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colorClass = bgColors[charCodeSum % bgColors.length];

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn('rounded-full object-cover border border-white shadow-soft-xs select-none', sizes[size], className)}
      />
    );
  }

  return (
    <div
      title={name}
      className={cn(
        'rounded-full flex items-center justify-center font-semibold border border-white shadow-soft-xs select-none shrink-0',
        colorClass,
        sizes[size],
        className
      )}
    >
      {initials}
    </div>
  );
};

export interface AvatarGroupProps {
  users: { name: string; src?: string }[];
  max?: number;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export const AvatarGroup: React.FC<AvatarGroupProps> = ({
  users = [],
  max = 3,
  size = 'xs',
  className,
}) => {
  const visible = users.slice(0, max);
  const overflow = users.length - max;

  const sizeClasses = {
    xs: 'h-5 w-5 text-[9px] ring-1.5',
    sm: 'h-6 w-6 text-[10px] ring-2',
    md: 'h-7 w-7 text-xs ring-2',
  };

  return (
    <div className={cn('flex items-center -space-x-1.5 overflow-hidden', className)}>
      {visible.map((user, idx) => (
        <div key={idx} className={cn('relative rounded-full ring-white', sizeClasses[size])}>
          <Avatar name={user.name} src={user.src} size={size === 'xs' ? 'xs' : size === 'sm' ? 'sm' : 'md'} />
        </div>
      ))}
      {overflow > 0 && (
        <div
          title={`${overflow} more`}
          className={cn(
            'relative rounded-full bg-sage-200 text-sage-800 font-bold flex items-center justify-center ring-white',
            sizeClasses[size]
          )}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
};
