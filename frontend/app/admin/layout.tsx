'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  Building2,
  Users,
  Settings,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const bottomNavItems = [
    { label: 'Overview', href: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Clients', href: '/admin/clients', icon: Building2 },
    { label: 'Users', href: '/admin/users', icon: Users },
    { label: 'Settings', href: '/admin/settings', icon: Settings },
  ];

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="flex h-screen bg-[#F7F8F5] overflow-hidden text-sage-900">
        {/* Desktop Sidebar (md screens and up) */}
        <div className="hidden md:flex shrink-0">
          <Sidebar mode="admin" />
        </div>

        {/* Mobile Navigation Drawer (Slide-over with Backdrop) */}
        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
              onClick={() => setMobileDrawerOpen(false)}
            />
            {/* Drawer Container */}
            <div className="relative flex-1 flex flex-col max-w-[270px] w-full bg-[#051009] shadow-2xl z-50 animate-in slide-in-from-left duration-200">
              <div className="absolute top-5 right-3.5 z-40">
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-[#4E775C] hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <Sidebar mode="admin" onNavigate={() => setMobileDrawerOpen(false)} />
            </div>
          </div>
        )}

        {/* Main Content Viewport */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Mobile Top Header (hidden on md and up) */}
          <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#051009] border-b border-[#13271A] sticky top-0 z-20 text-white shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg overflow-hidden bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shrink-0">
                <Image
                  src="/icons/icon-192x192.png"
                  alt="flumenxConectOS"
                  width={24}
                  height={24}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-xs text-white tracking-wider leading-none uppercase">
                  FLUMENX<span className="text-emerald-400">OS</span>
                </span>
                <span className="text-[9px] text-[#4E775C] tracking-wider uppercase font-bold mt-0.5">
                  Super Admin HQ
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <NotificationCenter />
              <Avatar name={user?.name || 'Admin'} size="xs" />
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                className="p-1.5 rounded-lg text-emerald-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Desktop Topbar (hidden on mobile) */}
          <div className="hidden md:block">
            <Topbar mode="admin" />
          </div>

          {/* Main Scrollable Page Content */}
          <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-8">
            {children}
          </main>

          {/* Mobile Bottom Navigation Bar */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#051009] border-t border-[#13271A] px-3 flex items-center justify-around z-30 shadow-2xl">
            {bottomNavItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-bold tracking-wider uppercase transition-colors relative',
                    isActive ? 'text-emerald-400 font-extrabold' : 'text-[#7E9F8B] hover:text-white'
                  )}
                >
                  <Icon className={cn('h-5 w-5 mb-0.5', isActive ? 'stroke-[2.2]' : 'stroke-[1.75]')} />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* "More" button to toggle full drawer */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-bold tracking-wider uppercase text-[#7E9F8B] hover:text-white"
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

