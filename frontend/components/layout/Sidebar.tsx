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
  User,
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

interface NavSection {
  title?: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ mode, clientName, onNavigate }) => {
  const pathname = usePathname();
  const { user, memberships, activeClient, switchWorkspace, logout } = useAuth();

  const displayClientName = clientName || activeClient?.clientName || 'Acme Co.';

  const adminSections: NavSection[] = [
    {
      title: 'WORKSPACE',
      items: [
        { label: 'DASHBOARD', href: '/admin/dashboard', icon: LayoutDashboard },
        { label: 'CLIENTS', href: '/admin/clients', icon: Building2 },
        { label: 'STAFF & USERS', href: '/admin/users', icon: Users },
        { label: 'ROLES & RBAC', href: '/admin/roles', icon: ShieldCheck },
      ],
    },
    {
      title: 'SYSTEM',
      items: [
        { label: 'INTEGRATIONS', href: '/admin/integrations', icon: Radio },
        { label: 'AUDIT TRAIL', href: '/admin/audit-logs', icon: FileSpreadsheet },
        { label: 'SETTINGS', href: '/admin/settings', icon: Settings },
      ],
    },
  ];

  const [unreadCount, setUnreadCount] = React.useState<number>(0);
  const [openTasksCount, setOpenTasksCount] = React.useState<number>(0);

  React.useEffect(() => {
    if (mode !== 'client') return;
    let isMounted = true;

    const fetchCounts = async () => {
      try {
        const { getConversationsApi } = await import('@/lib/conversations');
        const { getTasksApi } = await import('@/lib/tasks');

        const [convRes, tasksRes] = await Promise.all([
          getConversationsApi({ limit: 1 }).catch(() => null),
          getTasksApi({ status: 'open', limit: 1 }).catch(() => null),
        ]);

        if (isMounted) {
          if (convRes?.counts?.unread !== undefined) {
            setUnreadCount(convRes.counts.unread);
          }
          if (tasksRes?.data?.pagination?.total !== undefined) {
            setOpenTasksCount(tasksRes.data.pagination.total);
          }
        }
      } catch (err) {
        // Silently ignore
      }
    };

    fetchCounts();
    const interval = setInterval(fetchCounts, 60000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [mode, activeClient?.clientId]);

  const clientSections: NavSection[] = [
    {
      title: 'WORKSPACE',
      items: [
        { label: 'DASHBOARD', href: '/client/dashboard', icon: LayoutDashboard },
        { label: 'LEADS', href: '/client/leads', icon: Users },
        { label: 'PIPELINE', href: '/client/leads/pipeline', icon: CheckSquare },
        {
          label: 'INBOX',
          href: '/client/inbox',
          icon: MessageSquare,
          badge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount.toString()) : undefined,
          badgeColor: 'bg-emerald-500',
        },
        {
          label: 'TASKS',
          href: '/client/tasks',
          icon: CheckSquare,
          badge: openTasksCount > 0 ? (openTasksCount > 99 ? '99+' : openTasksCount.toString()) : undefined,
          badgeColor: 'bg-emerald-500',
        },
      ],
    },
    {
      title: 'MARKETING',
      items: [
        { label: 'CAMPAIGNS', href: '/client/campaigns', icon: Megaphone },
        { label: 'FORMS', href: '/client/forms', icon: FileText },
        { label: 'REPORTS', href: '/client/reports', icon: BarChart3 },
        { label: 'REQUESTS', href: '/client/requests', icon: FileText },
        { label: 'AUTOMATIONS', href: '/client/workflows', icon: Workflow },
        { label: 'BROADCAST', href: '/client/broadcast', icon: Send },
        { label: 'CLIENT PORTAL', href: '/portal', icon: ShieldCheck },
      ],
    },
    {
      title: 'ACCOUNT',
      items: [
        { label: 'TEAM', href: '/client/team', icon: Users },
        { label: 'INTEGRATIONS', href: '/client/integrations', icon: Zap },
        { label: 'SETTINGS', href: '/client/settings', icon: Settings },
      ],
    },
  ];

  const sections = mode === 'admin' ? adminSections : clientSections;

  return (
    <aside className="w-full md:w-64 bg-[#051009] text-white flex flex-col shrink-0 h-full md:h-screen md:sticky top-0 md:border-r border-[#13271A] select-none z-30">
      {/* Brand Header */}
      <div className="h-20 flex flex-col justify-center px-5 border-b border-[#13271A] bg-[#040C07]">
        <Link
          href={mode === 'admin' ? '/admin/dashboard' : '/client/dashboard'}
          className="flex flex-col group min-w-0"
        >
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg overflow-hidden bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <img
                src="/icons/icon-192x192.png"
                alt="flumenxConectOS"
                className="h-5 w-5 object-contain"
              />
            </div>
            <span className="font-extrabold text-white text-base tracking-wider leading-none uppercase">
              FLUMENX<span className="text-emerald-400">OS</span>
            </span>
          </div>
          <span className="text-[9px] text-[#4E775C] tracking-[0.22em] uppercase font-bold mt-1.5 truncate">
            {mode === 'admin' ? 'SUPER ADMIN PLATFORM' : 'MARKETING OPERATIONS'}
          </span>
        </Link>
      </div>

      {/* Workspace Context & Switcher */}
      {mode === 'client' && (
        <div className="px-3.5 py-3 border-b border-[#13271A] bg-[#06140C]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-bold text-[#4E775C] uppercase tracking-[0.2em]">WORKSPACE</span>
            {user?.isSuperAdmin && (
              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-700/50">Admin</span>
            )}
          </div>
          {memberships.length > 1 || user?.isSuperAdmin ? (
            <div className="relative">
              <select
                value={activeClient?.clientId || ''}
                onChange={(e) => switchWorkspace(e.target.value)}
                className="w-full appearance-none bg-[#091C11] border border-[#1B3B26] rounded-lg pl-8 pr-7 py-1.5 text-xs text-emerald-100 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer shadow-sm"
              >
                {memberships.map((m) => (
                  <option key={m.clientId} value={m.clientId} className="bg-[#091C11] text-white">
                    {m.clientName}
                  </option>
                ))}
              </select>
              <Building className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-400 pointer-events-none" />
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#4E775C] pointer-events-none" />
            </div>
          ) : (
            <div className="flex items-center gap-2 p-1.5 bg-[#091C11] border border-[#1B3B26] rounded-lg shadow-sm">
              <div className="p-1 rounded bg-emerald-500/10 text-emerald-400">
                <Building className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-semibold text-emerald-100 truncate">{displayClientName}</span>
            </div>
          )}
        </div>
      )}

      {/* Navigation Links with FLOXA Section Groups */}
      <nav className="flex-1 overflow-y-auto px-3.5 py-4 space-y-5">
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-1.5">
            {section.title && (
              <div className="px-3 pt-0.5 pb-1">
                <span className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-[#4E775C]">
                  {section.title}
                </span>
              </div>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/client/leads' && pathname.startsWith(`${item.href}/`));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center justify-between px-3.5 py-2.5 rounded-lg text-[11px] font-bold tracking-wider uppercase transition-all duration-150 group',
                      isActive
                        ? 'bg-white/[0.05] text-white border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.03)]'
                        : 'text-[#7E9F8B] hover:text-white hover:bg-white/[0.03] border border-transparent'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0 transition-colors',
                          isActive ? 'text-white stroke-[2.2]' : 'text-[#4E775C] group-hover:text-emerald-300 stroke-[1.8]'
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-bold text-white shrink-0', item.badgeColor || 'bg-emerald-500')}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer User Profile Card */}
      <div className="p-3 border-t border-[#13271A] bg-[#040C07]">
        <div className="p-2.5 rounded-lg bg-[#07170E] border border-[#152E1D] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
              <User className="h-4 w-4" />
            </div>
            <div className="flex flex-col min-w-0 overflow-hidden">
              <span className="text-xs font-bold text-white truncate leading-tight">
                {user?.name || (mode === 'admin' ? 'Super Admin' : 'John Doe')}
              </span>
              <span className="text-[9.5px] text-[#4E775C] font-semibold tracking-wider uppercase truncate leading-tight mt-0.5">
                {mode === 'admin' ? 'Administrator' : 'Client Admin'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            title="Sign Out"
            className="text-[#4E775C] hover:text-rose-400 p-1.5 rounded-md hover:bg-rose-950/40 transition-colors shrink-0"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};

