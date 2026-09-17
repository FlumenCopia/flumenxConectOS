'use client';

import React from 'react';
import Link from 'next/link';
import { Bell, ChevronRight, Shield, Building, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/hooks/useAuth';
import { NotificationCenter } from '../notifications/NotificationCenter';

interface TopbarProps {
  mode: 'admin' | 'client';
  breadcrumbs?: { label: string; href?: string }[];
}

export const Topbar: React.FC<TopbarProps> = ({ mode, breadcrumbs = [] }) => {
  const { user, activeClient, memberships, switchWorkspace } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 sticky top-0 z-20">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link
          href={mode === 'admin' ? '/admin/dashboard' : '/client/dashboard'}
          className="hover:text-slate-900 font-medium transition-colors"
        >
          {mode === 'admin' ? 'Admin Console' : (activeClient?.clientName || 'Client Workspace')}
        </Link>
        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={idx}>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            {crumb.href ? (
              <Link href={crumb.href} className="hover:text-slate-900 font-medium transition-colors">
                {crumb.label}
              </Link>
            ) : (
              <span className="text-slate-900 font-semibold">{crumb.label}</span>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Client Workspace Switcher for Super Admin or Multi-Tenant Users */}
        {mode === 'client' && (user?.isSuperAdmin || memberships.length > 1) && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-50/70 border border-brand-200 rounded-lg shadow-sm">
            <Building className="h-4 w-4 text-brand-600 shrink-0" />
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-500 hidden md:inline">Workspace:</span>
              <select
                value={activeClient?.clientId || ''}
                onChange={(e) => switchWorkspace(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 border-none p-0 focus:ring-0 cursor-pointer outline-none"
              >
                {memberships.map((m) => (
                  <option key={m.clientId} value={m.clientId}>
                    {m.clientName}
                  </option>
                ))}
              </select>
            </div>
            {user?.isSuperAdmin && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-brand-600 text-white uppercase tracking-wider hidden sm:inline">
                Super Admin
              </span>
            )}
          </div>
        )}

        {/* Regular Environment / Tenant Status Indicator */}
        {mode === 'admin' && (
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600">
            <Shield className="h-3.5 w-3.5 text-brand-700" />
            <span className="font-medium">FlumenX Internal HQ</span>
          </div>
        )}

        {!user?.isSuperAdmin && memberships.length <= 1 && mode === 'client' && (
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600">
            <Building className="h-3.5 w-3.5 text-brand-600" />
            <span className="font-medium font-semibold text-slate-800">{activeClient?.clientName || 'Isolated Client Workspace'}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono border border-emerald-200">Tenant Isolated</span>
          </div>
        )}

        {/* Portal Switcher (For demonstration & Super Admin rapid access) */}
        <Link
          href={mode === 'admin' ? '/client/dashboard' : '/admin/dashboard'}
          className="text-xs text-brand-700 hover:text-brand-800 font-medium flex items-center gap-1.5 px-2.5 py-1.5 rounded hover:bg-slate-50 transition-colors border border-slate-200"
        >
          <Globe className="h-3.5 w-3.5" />
          <span>Switch to {mode === 'admin' ? 'Client Workspace' : 'Super Admin'}</span>
        </Link>

        {/* Notification Center */}
        <NotificationCenter />
      </div>
    </header>
  );
};
