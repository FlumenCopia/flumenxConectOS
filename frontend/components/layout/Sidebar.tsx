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
  ChevronDown,
  Building,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';

interface SidebarProps {
  mode: 'admin' | 'client';
  clientName?: string;
  onNavigate?: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ mode, clientName, onNavigate }) => {
  const pathname = usePathname();
  const { user, memberships, activeClient, switchWorkspace, logout } = useAuth();

  const displayClientName = clientName || activeClient?.clientName || 'Acme Co.';

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
    { label: 'Leads', href: '/client/leads', icon: Users },
    { label: 'Pipeline Board', href: '/client/leads/pipeline', icon: CheckSquare },
    { label: 'Inbox', href: '/client/inbox', icon: MessageSquare, badge: '3', badgeColor: 'bg-rose-500' },
    { label: 'Tasks', href: '/client/tasks', icon: CheckSquare, badge: '5', badgeColor: 'bg-rose-500' },
    { label: 'Campaigns', href: '/client/campaigns', icon: Megaphone },
    { label: 'Forms', href: '/client/forms', icon: FileText },
    { label: 'Reports', href: '/client/reports', icon: BarChart3 },
    { label: 'Customer Requests', href: '/client/requests', icon: FileText },
    { label: 'Automations', href: '/client/workflows', icon: Workflow },
    { label: 'Broadcast Blast', href: '/client/broadcast', icon: Send },
    { label: 'Customer Portal', href: '/portal', icon: ShieldCheck },
    { label: 'Team', href: '/client/team', icon: Users },
    { label: 'Integrations', href: '/client/integrations', icon: Zap },
    { label: 'Approvals', href: '/client/approvals', icon: CheckCircle2 },
    { label: 'Settings', href: '/client/settings', icon: Settings },
  ];

  const navItems = mode === 'admin' ? adminNavItems : clientNavItems;

  return (
    <aside className="w-64 bg-white text-sage-900 flex flex-col shrink-0 h-screen sticky top-0 border-r border-sage-200/90 select-none shadow-soft-xs z-30">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-5 border-b border-sage-100">
        <Link
          href={mode === 'admin' ? '/admin/dashboard' : '/client/dashboard'}
          className="flex items-center gap-2.5 group"
        >
          <img
            src="/icons/icon-192x192.png"
            alt="flumenxConectOS"
            className="h-8 w-8 rounded-xl object-contain shadow-soft-xs group-hover:scale-105 transition-transform shrink-0"
          />
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-charcoal-900 text-sm tracking-tight leading-tight">
              flumenx<span className="text-forest-700">Conect</span><span className="text-lime-600">OS</span>
            </span>
            <span className="text-[9px] text-sage-500 tracking-wider uppercase font-medium">
              {mode === 'admin' ? 'Super Admin HQ' : 'Marketing Operations'}
            </span>
          </div>
        </Link>
      </div>

      {/* Workspace Context & Switcher */}
      {mode === 'client' && (
        <div className="px-4 py-3 border-b border-sage-100 bg-sage-50/50">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold text-sage-500 uppercase tracking-wider">Client Workspace</span>
            {user?.isSuperAdmin && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-brand-100 text-brand-800">Admin</span>
            )}
          </div>
          {memberships.length > 1 || user?.isSuperAdmin ? (
            <div className="relative">
              <select
                value={activeClient?.clientId || ''}
                onChange={(e) => switchWorkspace(e.target.value)}
                className="w-full appearance-none bg-white border border-sage-200 rounded-lg pl-8 pr-7 py-1.5 text-xs text-sage-900 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 cursor-pointer shadow-soft-xs"
              >
                {memberships.map((m) => (
                  <option key={m.clientId} value={m.clientId}>
                    {m.clientName}
                  </option>
                ))}
              </select>
              <Building className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-brand-700 pointer-events-none" />
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sage-400 pointer-events-none" />
            </div>
          ) : (
            <div className="flex items-center gap-2 p-1.5 bg-white border border-sage-200 rounded-lg shadow-soft-xs">
              <div className="p-1 rounded bg-brand-50 text-brand-800">
                <Building className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-bold text-sage-900 truncate">{displayClientName}</span>
            </div>
          )}
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/client/leads' && pathname.startsWith(`${item.href}/`));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150',
                isActive
                  ? 'bg-brand-50 text-brand-800 font-semibold shadow-soft-xs'
                  : 'text-sage-600 hover:bg-sage-100/70 hover:text-sage-900'
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={cn('h-4 w-4', isActive ? 'text-brand-800 stroke-[2.2]' : 'text-sage-400 stroke-[1.75]')} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={cn('px-1.5 py-0.2 rounded-full text-[10px] font-bold text-white shadow-soft-xs', item.badgeColor || 'bg-brand-600')}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer User Profile & Logout */}
      <div className="p-3 border-t border-sage-100 bg-sage-50/40 flex items-center justify-between">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <Avatar name={user?.name || (mode === 'admin' ? 'Super Admin' : 'Client Manager')} size="sm" />
          <div className="flex flex-col overflow-hidden">
            <span className="text-xs font-bold text-sage-900 truncate">
              {user?.name || (mode === 'admin' ? 'Super Admin' : 'John Doe')}
            </span>
            <span className="text-[10px] text-sage-500 truncate">
              {mode === 'admin' ? 'Administrator' : 'Client Admin'}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => logout()}
          title="Sign Out"
          className="text-sage-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
};

