'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  Users,
  Building2,
  ShieldCheck,
  Zap,
  FileSpreadsheet,
  Settings,
  MessageSquare,
  FileText,
  Megaphone,
  CheckSquare,
  BarChart3,
  CheckCircle2,
  Workflow,
  Radio,
  Send,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  mode: 'admin' | 'client';
  clientName?: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ mode, clientName }) => {
  const pathname = usePathname();
  const { user, memberships, activeClient, switchWorkspace, logout } = useAuth();

  const displayClientName = clientName || activeClient?.clientName || 'Workspace';

  const adminNavItems: NavItem[] = [
    { label: 'Overview', href: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Clients', href: '/admin/clients', icon: Building2 },
    { label: 'Staff & Users', href: '/admin/users', icon: Users },
    { label: 'Roles & RBAC', href: '/admin/roles', icon: ShieldCheck },
    { label: 'Integrations Health', href: '/admin/integrations', icon: Radio },
    { label: 'Audit Trail', href: '/admin/audit-logs', icon: FileSpreadsheet },
    { label: 'System Settings', href: '/admin/settings', icon: Settings },
  ];

  const clientNavItems: NavItem[] = [
    { label: 'Dashboard', href: '/client/dashboard', icon: LayoutDashboard },
    { label: 'Business Profile', href: '/client/profile', icon: FileText },
    { label: 'Team Members', href: '/client/team', icon: Users },
    { label: 'Leads CRM', href: '/client/leads', icon: Users },
    { label: 'Pipeline Board', href: '/client/leads/pipeline', icon: CheckSquare },
    { label: 'Unified Inbox', href: '/client/inbox', icon: MessageSquare, badge: '3' },
    { label: 'Broadcast Blast', href: '/client/broadcast', icon: Send },
    { label: 'Customer Requests', href: '/client/requests', icon: FileText },
    { label: 'Portal Users', href: '/client/portal-users', icon: ShieldCheck },
    { label: 'Website Forms', href: '/client/forms', icon: FileText },
    { label: 'Campaigns', href: '/client/campaigns', icon: Megaphone },
    { label: 'Tasks & Follow-ups', href: '/client/tasks', icon: CheckSquare },
    { label: 'Automations', href: '/client/workflows', icon: Workflow },
    { label: 'Integrations', href: '/client/integrations', icon: Zap },
    { label: 'Reports & Analytics', href: '/client/reports', icon: BarChart3 },
    { label: 'Approvals', href: '/client/approvals', icon: CheckCircle2 },
    { label: 'Settings', href: '/client/settings', icon: Settings },
  ];

  const navItems = mode === 'admin' ? adminNavItems : clientNavItems;

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : mode === 'admin'
    ? 'SA'
    : 'CA';

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 h-screen sticky top-0 border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
        <div className="h-8 w-8 rounded bg-brand-600 flex items-center justify-center font-bold text-white text-base tracking-wider">
          FX
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-white text-sm tracking-tight">flumenxConectOS</span>
          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">
            {mode === 'admin' ? 'Super Admin' : 'Client Portal'}
          </span>
        </div>
      </div>

      {/* Workspace Context & Switcher (for Client Portal) */}
      {mode === 'client' && (
        <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Workspace</p>
            {(memberships.length > 1 || user?.isSuperAdmin) && (
              <span className="text-[10px] text-brand-400 font-medium font-mono">
                {user?.isSuperAdmin ? 'Super Admin' : 'Switchable'}
              </span>
            )}
          </div>
          {memberships.length > 1 || user?.isSuperAdmin ? (
            <select
              value={activeClient?.clientId || ''}
              onChange={(e) => switchWorkspace(e.target.value)}
              className="mt-1.5 w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-medium focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
            >
              {memberships.map((m) => (
                <option key={m.clientId} value={m.clientId}>
                  {m.clientName}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm font-semibold text-white truncate mt-0.5">{displayClientName}</p>
          )}
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors',
                isActive
                  ? 'bg-brand-800 text-white font-semibold shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={cn('h-4 w-4', isActive ? 'text-white' : 'text-slate-400')} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-600 text-white">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer Profile / Logout */}
      <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/20">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="h-7 w-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold text-white shrink-0">
            {initials}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-xs font-medium text-white truncate">
              {user?.name || (mode === 'admin' ? 'Super Administrator' : 'Client Manager')}
            </span>
            <span className="text-[10px] text-slate-400 truncate">
              {user?.email || (mode === 'admin' ? 'admin@flumenx.com' : 'manager@client.com')}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => logout()}
          title="Sign Out"
          className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
};
