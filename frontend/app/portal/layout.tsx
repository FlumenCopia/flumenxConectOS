'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { PortalAuthProvider, usePortalAuth } from '@/context/PortalAuthContext';
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  CheckSquare,
  Bell,
  User,
  LogOut,
  Shield,
  Loader2,
  Menu,
  X,
  ExternalLink,
} from 'lucide-react';

function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout } = usePortalAuth();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  // Check if current route is a public auth page
  const isAuthPage =
    pathname.startsWith('/portal/login') ||
    pathname.startsWith('/portal/accept-invitation') ||
    pathname.startsWith('/portal/forgot-password') ||
    pathname.startsWith('/portal/reset-password');

  if (isAuthPage) {
    return <div className="min-h-screen bg-[#F7F8F5] text-sage-900">{children}</div>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F7F8F5] flex flex-col items-center justify-center text-sage-600">
        <Loader2 className="w-9 h-9 animate-spin text-brand-700 mb-3" />
        <p className="text-xs font-semibold text-sage-500">Verifying customer portal session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F7F8F5] flex flex-col items-center justify-center p-6 text-center text-sage-900">
        <div className="max-w-md w-full p-8 rounded-2xl bg-white border border-sage-200/90 shadow-soft-lg">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-800">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight mb-2">Customer Portal Authentication</h2>
          <p className="text-sage-500 text-xs mb-6">
            Please log in with your customer portal credentials to access your account, support tickets, and documents.
          </p>
          <Link
            id="portal-login-redirect-btn"
            href="/portal/login"
            className="inline-flex items-center justify-center w-full px-5 py-2.5 text-xs font-bold rounded-lg bg-brand-800 hover:bg-brand-700 text-white transition-all shadow-forest-sm"
          >
            Go to Customer Login
          </Link>
        </div>
      </div>
    );
  }

  const navItems = [
    { label: 'Overview', href: '/portal', icon: LayoutDashboard, exact: true },
    { label: 'My Requests', href: '/portal/requests', icon: FileText },
    { label: 'Conversations', href: '/portal/conversations', icon: MessageSquare },
    { label: 'Action Items & Tasks', href: '/portal/tasks', icon: CheckSquare },
    { label: 'Notifications', href: '/portal/notifications', icon: Bell },
    { label: 'My Profile & Consent', href: '/portal/profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-[#F7F8F5] text-sage-900 flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3.5 bg-white border-b border-sage-200/90 sticky top-0 z-40 shadow-soft-xs">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 shadow-forest-sm">
            <Image
              src="/icons/icon-192x192.png"
              alt="flumenxConect Portal"
              width={28}
              height={28}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <span className="font-bold text-xs tracking-tight block">Customer Portal</span>
            <span className="text-[10px] text-sage-500 block truncate max-w-[150px]">{user?.clientName || 'Workspace'}</span>
          </div>
        </div>
        <button
          id="mobile-nav-toggle-btn"
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          className="p-1.5 rounded-lg bg-sage-50 border border-sage-200 text-sage-600 hover:text-sage-900"
        >
          {mobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>

      {/* Sidebar Desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-sage-200/90 p-5 flex flex-col justify-between transition-transform duration-200 shadow-soft-xs lg:static lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Brand header */}
          <div className="flex items-center space-x-2.5 mb-6">
            <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 shadow-forest-sm">
              <Image
                src="/icons/icon-192x192.png"
                alt="flumenxConect Portal"
                width={32}
                height={32}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-sage-900 flex items-center space-x-1.5">
                <span>flumenxConect</span>
                <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-brand-50 text-brand-800 border border-brand-200">
                  Portal
                </span>
              </h1>
              <p className="text-[10px] text-sage-500 truncate max-w-[150px]">{user?.clientName || 'Customer Portal'}</p>
            </div>
          </div>

          {/* User badge */}
          <div className="mb-5 p-3 rounded-xl bg-sage-50/70 border border-sage-200/80 flex items-center space-x-2.5 shadow-soft-xs">
            <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-800 border border-brand-200 flex items-center justify-center font-bold text-xs">
              {user?.name?.charAt(0) || 'C'}
            </div>
            <div className="overflow-hidden flex-1 leading-tight">
              <p className="text-xs font-bold text-sage-900 truncate">{user?.name}</p>
              <p className="text-[10px] text-sage-500 truncate">{user?.email}</p>
            </div>
          </div>

          {/* Navigation links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  id={`portal-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  href={item.href}
                  onClick={() => setMobileNavOpen(false)}
                  className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    active
                      ? 'bg-brand-50 text-brand-800 font-semibold shadow-soft-xs'
                      : 'text-sage-600 hover:text-sage-900 hover:bg-sage-100/70'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-brand-800 stroke-[2.2]' : 'text-sage-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom controls */}
        <div className="pt-3 border-t border-sage-100">
          <button
            id="portal-logout-btn"
            onClick={logout}
            className="flex items-center space-x-2.5 w-full px-3 py-2 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

export default function CustomerPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalAuthProvider>
      <PortalShell>{children}</PortalShell>
    </PortalAuthProvider>
  );
}

