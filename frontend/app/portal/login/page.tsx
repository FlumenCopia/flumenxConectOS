'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePortalAuth } from '@/context/PortalAuthContext';
import { Shield, KeyRound, Mail, AlertCircle, Loader2 } from 'lucide-react';

export default function PortalLoginPage() {
  const { login } = usePortalAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        'Unable to log in. Please check your email and password.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 mb-4 shadow-xl shadow-indigo-600/10">
            <Shield className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Customer Portal</h1>
          <p className="text-sm text-slate-400 mt-1">Sign in to manage your requests, tasks, and communications</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-5 sm:p-8 rounded-2xl shadow-2xl">
          {error && (
            <div
              id="portal-login-error"
              className="mb-6 p-3.5 sm:p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start space-x-3"
            >
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div>
              <label htmlFor="portal-email-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500 absolute left-3.5 top-3" />
                <input
                  id="portal-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 sm:pl-11 pr-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-xs sm:text-sm"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="portal-password-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Password
                </label>
                <Link
                  id="portal-forgot-password-link"
                  href="/portal/forgot-password"
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500 absolute left-3.5 top-3" />
                <input
                  id="portal-password-input"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 sm:pl-11 pr-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-xs sm:text-sm"
                />
              </div>
            </div>

            <button
              id="portal-login-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 sm:py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all shadow-lg shadow-indigo-600/25 active:scale-98"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          <div className="mt-5 sm:mt-6 pt-5 sm:pt-6 border-t border-slate-800 space-y-4 text-center">
            <p className="text-xs text-slate-500">
              Have an invitation link?{' '}
              <Link
                id="portal-accept-invite-link"
                href="/portal/accept-invitation"
                className="text-indigo-400 hover:text-indigo-300 font-medium"
              >
                Activate Account
              </Link>
            </p>

            {/* Quick Demo Login Credentials (Convenience) */}
            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 text-left space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-center">
                Demo Quick Fill
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEmail('customer@example.com');
                    setPassword('Password123!');
                    setError(null);
                  }}
                  className="p-2 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-[11px] text-slate-200 text-center transition-colors border border-slate-600/40 active:scale-98"
                >
                  <span className="font-semibold block text-indigo-300 truncate">customer@example.com</span>
                  <span className="text-[10px] text-slate-400 block">Password123!</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('portal-test-charlie@customer.local');
                    setPassword('OtherCustomerPassword123!');
                    setError(null);
                  }}
                  className="p-2 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-[11px] text-slate-200 text-center transition-colors border border-slate-600/40 active:scale-98"
                >
                  <span className="font-semibold block text-indigo-300 truncate">charlie@customer.local</span>
                  <span className="text-[10px] text-slate-400 block">OtherCustomerPassword123!</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
