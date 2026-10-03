'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { portalResetPasswordApi } from '@/lib/api/portal';
import { Lock, KeyRound, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

function PortalResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = searchParams.get('token');
    if (t) setToken(t);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      setError('Password must contain at least one uppercase letter');
      return;
    }

    if (!/[0-9]/.test(newPassword)) {
      setError('Password must contain at least one number');
      return;
    }

    setLoading(true);

    try {
      await portalResetPasswordApi(token.trim(), newPassword);
      setSuccess(true);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        'Unable to reset password. The link may have expired or is invalid.'
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
          <h1 className="text-xl font-bold tracking-tight text-white">Set New Password</h1>
          <p className="text-xs text-[#7E9F8B] mt-1 max-w-xs mx-auto">
            Choose a secure new password for your customer portal account
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#07170E]/95 backdrop-blur-xl border border-[#13271A] p-6 sm:p-8 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.6)] space-y-5">
          {success ? (
            <div className="text-center space-y-4 py-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Password Updated</h3>
              <p id="portal-reset-success-msg" className="text-xs sm:text-sm text-[#98B5A2] leading-relaxed max-w-sm mx-auto">
                Your portal password has been reset successfully. All previous active sessions have been invalidated.
              </p>
              <div className="pt-3">
                <Link
                  id="portal-reset-login-link"
                  href="/portal/login"
                  className="inline-flex items-center justify-center w-full py-2.5 sm:py-3 px-4 rounded-xl bg-white hover:bg-neutral-100 text-[#040C07] font-bold text-xs sm:text-sm transition-all shadow-md active:scale-98 cursor-pointer"
                >
                  Sign In with New Password
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              {error && (
                <div className="p-3.5 sm:p-4 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs sm:text-sm flex items-start space-x-3">
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="portal-reset-token-input" className="block text-xs font-semibold uppercase tracking-wider text-[#7E9F8B] mb-1.5">
                  Reset Token
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#52705E] absolute left-3.5 top-3" />
                  <input
                    id="portal-reset-token-input"
                    type="text"
                    required
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Paste your reset token"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#040C07] border border-[#183622] text-white placeholder-[#456350] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all text-xs sm:text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="portal-reset-newpassword-input" className="block text-xs font-semibold uppercase tracking-wider text-[#7E9F8B] mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#52705E] absolute left-3.5 top-3" />
                  <input
                    id="portal-reset-newpassword-input"
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 chars, 1 uppercase, 1 number"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#040C07] border border-[#183622] text-white placeholder-[#456350] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="portal-reset-confirmpassword-input" className="block text-xs font-semibold uppercase tracking-wider text-[#7E9F8B] mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#52705E] absolute left-3.5 top-3" />
                  <input
                    id="portal-reset-confirmpassword-input"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#040C07] border border-[#183622] text-white placeholder-[#456350] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all text-xs sm:text-sm"
                  />
                </div>
              </div>

              <button
                id="portal-reset-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full py-2.5 sm:py-3 px-4 rounded-xl bg-white hover:bg-neutral-100 disabled:opacity-50 text-[#040C07] font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all shadow-md active:scale-98 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#040C07]" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <span>Reset Password</span>
                )}
              </button>

              <div className="pt-2 text-center">
                <Link
                  id="portal-reset-back-link"
                  href="/portal/login"
                  className="inline-flex items-center space-x-1.5 text-xs text-[#7E9F8B] hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to login</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PortalResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4 bg-[#040C07] text-white">
          <div className="flex items-center space-x-2 text-emerald-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-xs sm:text-sm font-medium text-[#7E9F8B]">Loading reset session...</span>
          </div>
        </div>
      }
    >
      <PortalResetPasswordForm />
    </Suspense>
  );
}
