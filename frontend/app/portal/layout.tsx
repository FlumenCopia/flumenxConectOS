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
      <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#040C07] border-b border-[#13271A] sticky top-0 z-30 shadow-soft-xs">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.2)] border border-emerald-500/30">
            <Image
              src="/icons/icon-192x192.png"
              alt="flumenxConect Portal"
              width={32}
              height={32}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-xs tracking-tight text-white">flumenxConect</span>
              <span className="text-[9px] uppercase font-extrabold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Portal
              </span>
            </div>
            <span className="text-[10px] text-[#7E9F8B] block truncate max-w-[180px]">
              {user?.clientName || 'Customer Portal'}
            </span>
          </div>
        </div>
        <button
          id="mobile-nav-toggle-btn"
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          aria-label={mobileNavOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
          className="p-2 rounded-xl bg-[#07170E] border border-[#152E1D] text-emerald-400 hover:text-emerald-300 hover:bg-[#0A2215] transition-colors"
        >
          {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Backdrop Overlay */}
      {mobileNavOpen && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Close sidebar overlay"
          onClick={() => setMobileNavOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || e.key === 'Enter') setMobileNavOpen(false);
          }}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Desktop & Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 max-w-[85vw] bg-[#040C07] border-r border-[#13271A] p-5 flex flex-col justify-between overflow-y-auto transition-transform duration-200 ease-out shadow-2xl lg:shadow-none lg:static lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Brand header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#13271A]">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.25)] border border-emerald-500/30">
                <Image
                  src="/icons/icon-192x192.png"
                  alt="flumenxConect Portal"
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-sm tracking-tight text-white flex items-center space-x-1.5">
                  <span>flumenxConect</span>
                  <span className="text-[9px] uppercase font-extrabold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Portal
                  </span>
                </h1>
                <p className="text-[10px] text-[#7E9F8B] truncate max-w-[140px]">
                  {user?.clientName || 'Customer Portal'}
                </p>
              </div>
            </div>
            {/* Close button inside drawer for mobile */}
            <button
              onClick={() => setMobileNavOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-[#7E9F8B] hover:text-white hover:bg-white/[0.05]"
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* User badge */}
          <div className="mb-5 p-3 rounded-xl bg-[#07170E] border border-[#152E1D] flex items-center space-x-2.5 shadow-sm">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 shadow-inner">
              {user?.name?.charAt(0) || 'C'}
            </div>
            <div className="overflow-hidden flex-1 min-w-0 leading-tight">
              <p className="text-xs font-bold text-white truncate">{user?.name}</p>
              <p className="text-[10px] text-[#7E9F8B] truncate">{user?.email}</p>
            </div>
          </div>

          {/* Navigation links */}
          <div className="px-1 pb-1 mb-1.5">
            <span className="text-[9.5px] font-extrabold uppercase tracking-[0.2em] text-[#4E775C]">
              PORTAL NAVIGATION
            </span>
          </div>

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
                  className={`flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 outline-none focus:outline-none ${
                    active
                      ? 'bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.08)]'
                      : 'text-[#7E9F8B] hover:text-white hover:bg-white/[0.04] border border-transparent'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      active ? 'text-emerald-400 stroke-[2.2]' : 'text-[#4E775C] group-hover:text-emerald-300'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom controls */}
        <div className="pt-4 mt-6 border-t border-[#13271A]">
          <button
            id="portal-logout-btn"
            onClick={logout}
            className="flex items-center space-x-2.5 w-full px-3 py-2 rounded-xl text-xs font-semibold text-rose-400/90 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all outline-none"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="max-w-7xl w-full mx-auto p-3.5 sm:p-6 lg:p-8">{children}</div>
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

