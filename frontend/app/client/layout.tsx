'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  CheckSquare,
  Menu,
  X,
  Plus,
  Bell,
  Building,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, activeClient } = useAuth();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const bottomNavItems = [
    { label: 'Home', href: '/client/dashboard', icon: LayoutDashboard },
    { label: 'Leads', href: '/client/leads', icon: Users },
    { label: 'Inbox', href: '/client/inbox', icon: MessageSquare, badge: true },
    { label: 'Tasks', href: '/client/tasks', icon: CheckSquare },
  ];

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-[#F7F8F5] overflow-hidden text-sage-900">
        {/* Desktop Sidebar (visible on md screens and up) */}
        <div className="hidden md:flex shrink-0">
          <Sidebar mode="client" />
        </div>

        {/* Mobile Navigation Drawer (Slide-over) */}
        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
              onClick={() => setMobileDrawerOpen(false)}
            />
            {/* Drawer */}
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white shadow-soft-lg z-50">
              <div className="absolute top-3.5 right-3.5">
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-sage-400 hover:text-sage-700 hover:bg-sage-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <Sidebar mode="client" onNavigate={() => setMobileDrawerOpen(false)} />
            </div>
          </div>
        )}

        {/* Main Content Viewport */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Mobile Top Header (hidden on md and up) */}
          <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-sage-200/90 sticky top-0 z-20 shadow-soft-xs">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-brand-800 text-white font-bold text-xs flex items-center justify-center shadow-forest-sm">
                FX
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xs text-sage-900 tracking-tight leading-none">flumenxConectOS</span>
                <span className="text-[10px] text-sage-500 truncate max-w-[130px] font-medium mt-0.5">
                  {activeClient?.clientName || 'Workspace'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <NotificationCenter />
              <Avatar name={user?.name || 'User'} size="xs" />
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                className="p-1.5 rounded-lg text-sage-600 hover:bg-sage-100"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Desktop Topbar (hidden on mobile) */}
          <div className="hidden md:block">
            <Topbar mode="client" />
          </div>

          {/* Scrollable Page Content */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-8">
            {children}
          </main>

          {/* Mobile Floating Action Button (FAB + - matches reference mobile design) */}
          <div className="md:hidden fixed bottom-18 right-4 z-30">
            <Link
              href="/client/leads"
              className="h-12 w-12 rounded-full bg-brand-800 hover:bg-brand-700 text-white shadow-forest-md flex items-center justify-center transition-transform active:scale-95"
            >
              <Plus className="h-6 w-6 stroke-[2.5]" />
            </Link>
          </div>

          {/* Mobile Bottom Navigation Bar (matches reference mobile design) */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-sage-200/90 px-3 flex items-center justify-around z-30 shadow-soft-lg">
            {bottomNavItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/client/leads' && pathname.startsWith(`${item.href}/`));
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-semibold transition-colors relative',
                    isActive ? 'text-brand-800' : 'text-sage-500 hover:text-sage-800'
                  )}
                >
                  <div className="relative">
                    <Icon className={cn('h-5 w-5 mb-0.5', isActive ? 'stroke-[2.2]' : 'stroke-[1.75]')} />
                    {item.badge && (
                      <span className="absolute -top-0.5 -right-1 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
                    )}
                  </div>
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* "More" button to toggle full drawer */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-semibold text-sage-500 hover:text-sage-800"
            >
              <Menu className="h-5 w-5 mb-0.5 stroke-[1.75]" />
              <span>More</span>
            </button>
          </nav>
        </div>
      </div>
    </ProtectedRoute>
  );
}

