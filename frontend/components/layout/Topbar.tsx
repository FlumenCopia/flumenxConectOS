'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronRight, Shield, Building, Globe, Calendar, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { NotificationCenter } from '../notifications/NotificationCenter';
import { SearchInput } from '@/components/ui/SearchInput';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';

interface TopbarProps {
  mode: 'admin' | 'client';
  breadcrumbs?: { label: string; href?: string }[];
}

export const Topbar: React.FC<TopbarProps> = ({ mode, breadcrumbs = [] }) => {
  const { user, activeClient, memberships, switchWorkspace } = useAuth();
  const [currentDate, setCurrentDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const now = new Date();
    const formatted = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(now);
    setCurrentDate(formatted);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-sage-200/90 px-4 sm:px-6 flex items-center justify-between shrink-0 sticky top-0 z-20 shadow-soft-xs">
      {/* Left: Global Search (Desktop) or Breadcrumb (Admin / Mobile) */}
      <div className="flex items-center gap-4 flex-1 max-w-md">
        {mode === 'client' ? (
          <div className="w-full hidden md:block">
            <SearchInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              placeholder="Search leads, messages, tasks..."
            />
          </div>
        ) : (
          /* Breadcrumbs */
          <div className="flex items-center gap-2 text-xs text-sage-500">
            <Link
              href="/admin/dashboard"
              className="hover:text-sage-900 font-semibold transition-colors"
            >
              Admin HQ
            </Link>
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                <ChevronRight className="h-3.5 w-3.5 text-sage-400" />
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-sage-900 font-medium transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-sage-900 font-semibold">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Date Indicator (matches reference design) */}
        {currentDate && (
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-sage-50/80 border border-sage-200/80 rounded-lg text-xs font-semibold text-sage-700 shadow-soft-xs select-none">
            <Calendar className="h-3.5 w-3.5 text-sage-500" />
            <span>{currentDate}</span>
          </div>
        )}

        {/* Client Workspace Switcher for Super Admin or Multi-Tenant Users */}
        {mode === 'client' && (user?.isSuperAdmin || memberships.length > 1) && (
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 bg-brand-50 border border-brand-200/80 rounded-lg shadow-soft-xs">
            <Building className="h-3.5 w-3.5 text-brand-800 shrink-0" />
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-semibold text-sage-500 hidden xl:inline">Workspace:</span>
              <select
                value={activeClient?.clientId || ''}
                onChange={(e) => switchWorkspace(e.target.value)}
                className="bg-transparent text-xs font-bold text-brand-900 border-none p-0 focus:ring-0 cursor-pointer outline-none"
              >
                {memberships.map((m) => (
                  <option key={m.clientId} value={m.clientId}>
                    {m.clientName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Portal Switcher */}
        <Link
          href={mode === 'admin' ? '/client/dashboard' : '/admin/dashboard'}
          className="hidden md:flex text-xs text-sage-600 hover:text-brand-800 font-medium items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-sage-50 transition-colors border border-sage-200 shadow-soft-xs"
        >
          <Globe className="h-3.5 w-3.5 text-sage-500" />
          <span>{mode === 'admin' ? 'Client Workspace' : 'Super Admin'}</span>
        </Link>

        {/* Notification Center */}
        <NotificationCenter />

        {/* User Pill (matches reference design) */}
        <div className="hidden sm:flex items-center gap-2 pl-1 pr-2.5 py-1 bg-sage-50/60 border border-sage-200/80 rounded-lg shadow-soft-xs">
          <Avatar name={user?.name || (mode === 'admin' ? 'Super Admin' : 'John Doe')} size="xs" />
          <div className="flex flex-col text-left leading-none">
            <span className="text-[11px] font-bold text-sage-900 truncate max-w-[100px]">
              {user?.name || (mode === 'admin' ? 'Super Admin' : 'John Doe')}
            </span>
            <span className="text-[9px] text-sage-500 truncate">
              {mode === 'admin' ? 'Admin' : 'Client Admin'}
            </span>
          </div>
        </div>

        {/* Primary Action Button (+ New Lead - matches reference design) */}
        {mode === 'client' && (
          <Link href="/client/leads">
            <Button size="sm" variant="primary" className="text-xs shadow-forest-sm hidden sm:inline-flex">
              <Plus className="h-3.5 w-3.5 mr-1" />
              <span>New Lead</span>
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
};

