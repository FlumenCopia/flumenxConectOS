'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePortalAuth } from '@/context/PortalAuthContext';
import { KeyRound, Mail, AlertCircle, Loader2 } from 'lucide-react';

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
        err.message ||
        'Unable to log in. Please check your email and password.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#040C07] text-white select-none">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#07170E] border border-emerald-500/30 shadow-[0_0_24px_rgba(16,185,129,0.25)] mb-3.5 p-2.5">
            <Image
              src="/icons/icon-192x192.png"
              alt="flumenxConect Portal"
              width={40}
              height={40}
              className="w-full h-full object-cover rounded-xl"
            />
          </div>
          <div className="flex items-center justify-center space-x-1.5 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-white">Customer Portal</h1>
            <span className="text-[9px] uppercase font-extrabold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              SECURE
            </span>
          </div>
          <p className="text-xs text-[#7E9F8B] max-w-xs mx-auto">
            Sign in to manage your service requests, action items, and communications
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#07170E]/95 backdrop-blur-xl border border-[#13271A] p-6 sm:p-8 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.6)] space-y-5">
          {error && (
            <div
              id="portal-login-error"
              className="p-3.5 sm:p-4 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs sm:text-sm flex items-start space-x-3"
            >
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div>
              <label htmlFor="portal-email-input" className="block text-xs font-semibold uppercase tracking-wider text-[#7E9F8B] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#52705E] absolute left-3.5 top-3" />
                <input
                  id="portal-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#040C07] border border-[#183622] text-white placeholder-[#456350] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all text-xs sm:text-sm"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="portal-password-input" className="block text-xs font-semibold uppercase tracking-wider text-[#7E9F8B]">
                  Password
                </label>
                <Link
                  id="portal-forgot-password-link"
                  href="/portal/forgot-password"
                  className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-[#52705E] absolute left-3.5 top-3" />
                <input
                  id="portal-password-input"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#040C07] border border-[#183622] text-white placeholder-[#456350] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all text-xs sm:text-sm"
                />
              </div>
            </div>

            <button
              id="portal-login-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 sm:py-3 px-4 rounded-xl bg-white hover:bg-neutral-100 disabled:opacity-50 text-[#040C07] font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all shadow-md active:scale-98 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#040C07]" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          <div className="pt-5 border-t border-[#13271A] space-y-4 text-center">
            <p className="text-xs text-[#7E9F8B]">
              Have an invitation link?{' '}
              <Link
                id="portal-accept-invite-link"
                href="/portal/accept-invitation"
                className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors"
              >
                Activate Account
              </Link>
            </p>

            {/* Quick Demo Login Credentials */}
            <div className="p-3 bg-[#040C07] rounded-xl border border-[#13271A] text-left space-y-2">
              <span className="text-[10px] font-bold text-[#7E9F8B] uppercase tracking-wider block text-center">
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
                  className="p-2 rounded-lg bg-[#07170E] hover:bg-[#0A2215] text-[11px] text-left transition-colors border border-[#183622] hover:border-emerald-500/40 active:scale-98 cursor-pointer"
                >
                  <span className="font-bold block text-emerald-400 truncate">customer@example.com</span>
                  <span className="text-[10px] text-[#7E9F8B] block">Password123!</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('portal-test-charlie@customer.local');
                    setPassword('OtherCustomerPassword123!');
                    setError(null);
                  }}
                  className="p-2 rounded-lg bg-[#07170E] hover:bg-[#0A2215] text-[11px] text-left transition-colors border border-[#183622] hover:border-emerald-500/40 active:scale-98 cursor-pointer"
                >
                  <span className="font-bold block text-emerald-400 truncate">charlie@customer.local</span>
                  <span className="text-[10px] text-[#7E9F8B] block">OtherCustomerPassword123!</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
