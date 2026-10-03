'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { usePortalAuth } from '@/context/PortalAuthContext';
import { Lock, User, Phone, KeyRound, AlertCircle, Loader2 } from 'lucide-react';

function AcceptInvitationForm() {
  const searchParams = useSearchParams();
  const { acceptInvitation } = usePortalAuth();

  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = searchParams.get('token');
    if (t) setToken(t);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError('Password must contain at least one uppercase letter');
      return;
    }

    if (!/[0-9]/.test(password)) {
      setError('Password must contain at least one number');
      return;
    }

    setLoading(true);

    try {
      await acceptInvitation({
        token: token.trim(),
        password,
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
      });
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        'Unable to activate account. The invitation token may be invalid, expired, or already used.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#040C07] text-white select-none">
      <div className="w-full max-w-lg">
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
            <h1 className="text-xl font-bold tracking-tight text-white">Activate Customer Account</h1>
            <span className="text-[9px] uppercase font-extrabold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              INVITATION
            </span>
          </div>
          <p className="text-xs text-[#7E9F8B] max-w-sm mx-auto">
            Set up your credentials to complete your customer portal onboarding
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#07170E]/95 backdrop-blur-xl border border-[#13271A] p-6 sm:p-8 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.6)] space-y-5">
          {error && (
            <div
              id="portal-invite-error"
              className="p-3.5 sm:p-4 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs sm:text-sm flex items-start space-x-3"
            >
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div>
              <label htmlFor="portal-invite-token-input" className="block text-xs font-semibold uppercase tracking-wider text-[#7E9F8B] mb-1.5">
                Invitation Token
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-[#52705E] absolute left-3.5 top-3" />
                <input
                  id="portal-invite-token-input"
                  type="text"
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste your invitation token"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#040C07] border border-[#183622] text-white placeholder-[#456350] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all text-xs sm:text-sm font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="portal-invite-name-input" className="block text-xs font-semibold uppercase tracking-wider text-[#7E9F8B] mb-1.5">
                  Full Name (Optional)
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#52705E] absolute left-3.5 top-3" />
                  <input
                    id="portal-invite-name-input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#040C07] border border-[#183622] text-white placeholder-[#456350] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="portal-invite-phone-input" className="block text-xs font-semibold uppercase tracking-wider text-[#7E9F8B] mb-1.5">
                  Phone (Optional)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#52705E] absolute left-3.5 top-3" />
                  <input
                    id="portal-invite-phone-input"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#040C07] border border-[#183622] text-white placeholder-[#456350] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all text-xs sm:text-sm"
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="portal-invite-password-input" className="block text-xs font-semibold uppercase tracking-wider text-[#7E9F8B] mb-1.5">
                New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#52705E] absolute left-3.5 top-3" />
                <input
                  id="portal-invite-password-input"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 chars with 1 uppercase & 1 number"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#040C07] border border-[#183622] text-white placeholder-[#456350] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all text-xs sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="portal-invite-confirm-password-input" className="block text-xs font-semibold uppercase tracking-wider text-[#7E9F8B] mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#52705E] absolute left-3.5 top-3" />
                <input
                  id="portal-invite-confirm-password-input"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#040C07] border border-[#183622] text-white placeholder-[#456350] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all text-xs sm:text-sm"
                />
              </div>
            </div>

            <button
              id="portal-invite-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 sm:py-3 px-4 rounded-xl bg-white hover:bg-neutral-100 disabled:opacity-50 text-[#040C07] font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all shadow-md active:scale-98 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#040C07]" />
                  <span>Activating Account...</span>
                </>
              ) : (
                <span>Complete Registration</span>
              )}
            </button>
          </form>

          <div className="pt-2 text-center">
            <Link
              id="portal-back-to-login-link"
              href="/portal/login"
              className="text-xs text-[#7E9F8B] hover:text-white transition-colors"
            >
              Already have an active account?{' '}
              <span className="font-semibold text-emerald-400 hover:text-emerald-300">Sign In</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4 bg-[#040C07] text-white">
          <div className="flex items-center space-x-2 text-emerald-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-xs sm:text-sm font-medium text-[#7E9F8B]">Loading invitation...</span>
          </div>
        </div>
      }
    >
      <AcceptInvitationForm />
    </Suspense>
  );
}
