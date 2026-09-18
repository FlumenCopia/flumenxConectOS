import React from 'react';
import { cn } from '@/lib/utils';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className,
}) => {
  return (
    <div className={cn('flex items-center gap-1 border-b border-sage-200/90 select-none', className)}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'pb-3 pt-1 px-3 text-xs font-semibold tracking-tight transition-all relative',
              isActive
                ? 'text-brand-800'
                : 'text-sage-500 hover:text-sage-800 hover:bg-sage-50/50 rounded-t'
            )}
          >
            <div className="flex items-center gap-2">
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={cn(
                    'px-1.5 py-0.2 rounded-full text-[10px] font-bold',
                    isActive
                      ? 'bg-brand-100 text-brand-800'
                      : 'bg-sage-100 text-sage-600'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </div>
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-800 rounded-t" />
            )}
          </button>
        );
      })}
    </div>
  );
};
