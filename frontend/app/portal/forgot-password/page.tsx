'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { portalForgotPasswordApi } from '@/lib/api/portal';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function PortalForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const msg = await portalForgotPasswordApi(email);
      setMessage(msg);
      setSubmitted(true);
    } catch (err: any) {
      // Even on error, standard enumeration-safe response
      setMessage('If the provided email is registered, password reset instructions have been sent.');
      setSubmitted(true);
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
          <h1 className="text-xl font-bold tracking-tight text-white">Reset Portal Password</h1>
          <p className="text-xs text-[#7E9F8B] mt-1 max-w-xs mx-auto">
            Enter your registered email address to receive password reset instructions
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#07170E]/95 backdrop-blur-xl border border-[#13271A] p-6 sm:p-8 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.6)] space-y-5">
          {submitted ? (
            <div className="text-center space-y-4 py-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p id="portal-forgot-password-success" className="text-xs sm:text-sm text-[#98B5A2] leading-relaxed max-w-sm mx-auto">
                {message}
              </p>
              <div className="pt-3">
                <Link
                  id="portal-back-to-login-btn"
                  href="/portal/login"
                  className="inline-flex items-center justify-center space-x-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Return to Login</span>
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
                <label htmlFor="portal-forgot-email-input" className="block text-xs font-semibold uppercase tracking-wider text-[#7E9F8B] mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#52705E] absolute left-3.5 top-3" />
                  <input
                    id="portal-forgot-email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#040C07] border border-[#183622] text-white placeholder-[#456350] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all text-xs sm:text-sm"
                  />
                </div>
              </div>

              <button
                id="portal-forgot-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full py-2.5 sm:py-3 px-4 rounded-xl bg-white hover:bg-neutral-100 disabled:opacity-50 text-[#040C07] font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all shadow-md active:scale-98 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#040C07]" />
                    <span>Sending Instructions...</span>
                  </>
                ) : (
                  <span>Send Reset Link</span>
                )}
              </button>

              <div className="pt-2 text-center">
                <Link
                  id="portal-forgot-cancel-link"
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
