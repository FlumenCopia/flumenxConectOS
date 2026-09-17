'use client';

import React from 'react';
import Link from 'next/link';
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
    return <div className="min-h-screen bg-slate-950 text-slate-50">{children}</div>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm tracking-wide text-slate-400">Verifying secure portal session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-100">
        <div className="max-w-md w-full p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl">
          <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Shield className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-2">Customer Portal Authentication</h2>
          <p className="text-slate-400 text-sm mb-6">
            Please log in with your customer portal credentials to access your account, support tickets, and documents.
          </p>
          <Link
            id="portal-login-redirect-btn"
            href="/portal/login"
            className="inline-flex items-center justify-center w-full px-5 py-3 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-600/25"
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between px-5 py-4 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
            FX
          </div>
          <div>
            <span className="font-semibold text-sm tracking-tight block">Customer Portal</span>
            <span className="text-xs text-slate-400 block truncate max-w-[160px]">{user?.clientName || 'Workspace'}</span>
          </div>
        </div>
        <button
          id="mobile-nav-toggle-btn"
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
        >
          {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar Desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 border-r border-slate-800 p-6 flex flex-col justify-between transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Brand header */}
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700 flex items-center justify-center text-white font-bold text-base shadow-lg shadow-indigo-600/30">
              FX
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight text-white flex items-center space-x-1.5">
                <span>flumenxConect</span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  Portal
                </span>
              </h1>
              <p className="text-xs text-slate-400 truncate max-w-[180px]">{user?.clientName || 'Customer Portal'}</p>
            </div>
          </div>

          {/* User badge */}
          <div className="mb-6 p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-sm">
              {user?.name?.charAt(0) || 'C'}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
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
                  className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    active
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom controls */}
        <div className="pt-4 border-t border-slate-800/80">
          <button
            id="portal-logout-btn"
            onClick={logout}
            className="flex items-center space-x-3 w-full px-3.5 py-2.5 rounded-xl text-sm font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
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
