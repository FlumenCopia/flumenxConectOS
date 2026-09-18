import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-sage-200/90">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-sage-900 tracking-tight">{title}</h1>
        {description && <p className="text-xs text-sage-500 mt-1 font-normal leading-relaxed">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2.5 shrink-0">{actions}</div>}
    </div>
  );
};

