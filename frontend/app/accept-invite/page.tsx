'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Lock, User, CheckCircle2, ArrowLeft, Loader2, AlertCircle, KeyRound, ShieldCheck } from 'lucide-react';
import { acceptInvitationApi } from '@/lib/clients';
import { getErrorMessage } from '@/lib/api';

function AcceptInviteForm() {
  const searchParams = useSearchParams();
  const urlToken = searchParams.get('token') || '';

  const [token, setToken] = useState(urlToken);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const t = searchParams.get('token');
    if (t) {
      setToken(t);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const activeToken = token.trim() || urlToken;
    if (!activeToken) {
      setError('Invitation token is required. Please check the link from your email.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (name.trim().length === 1) {
      setError('Full name must be at least 2 characters if provided.');
      return;
    }

    setIsLoading(true);
    try {
      await acceptInvitationApi({
        token: activeToken,
        password,
        name: name.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8F5] flex flex-col justify-center items-center p-4 sm:p-6 select-none">
      <div className="max-w-md w-full bg-white border border-sage-200/90 rounded-2xl shadow-soft-md p-8 sm:p-10">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <Image
              src="/images/logo.png"
              alt="flumenxConectOS"
              width={200}
              height={50}
              priority
              className="h-10 w-auto object-contain"
            />
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-50 border border-brand-200 text-brand-800 text-[11px] font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-700" />
            <span>Workspace Team Invitation</span>
          </div>
          <h1 className="text-xl font-bold text-charcoal-900">Accept Invitation</h1>
          <p className="text-xs text-charcoal-500 mt-1">
            Join your team workspace on flumenxConectOS to collaborate on leads, marketing, and client operations.
          </p>
        </div>

        {submitted ? (
          <div className="text-center space-y-5 py-2">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-3 text-left shadow-soft-xs">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-emerald-950">Invitation Accepted!</p>
                <p className="mt-1 text-emerald-800">Your account has been verified and added to the workspace. You can now sign in with your email and new password.</p>
              </div>
            </div>
            <Link href="/login" className="block w-full">
              <Button size="lg" className="w-full bg-brand-800 hover:bg-brand-900 text-white font-semibold rounded-xl h-11">
                Proceed to Sign In
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {!urlToken && (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-charcoal-700">
                  Invitation Token <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-charcoal-400">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Paste your invitation token"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-sage-300 rounded-xl focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 font-mono text-charcoal-900 bg-white"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-charcoal-700">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-charcoal-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-sage-300 rounded-xl focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 text-charcoal-900 bg-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-charcoal-700">
                Set Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-charcoal-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-sage-300 rounded-xl focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 text-charcoal-900 bg-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-charcoal-700">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-charcoal-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-sage-300 rounded-xl focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 text-charcoal-900 bg-white"
                />
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                className="w-full h-10 text-xs font-semibold gap-2 bg-brand-800 hover:bg-brand-900 text-white rounded-xl shadow-soft-xs"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Verifying & Activating...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Accept Invitation & Join</span>
                  </>
                )}
              </Button>
            </div>

            <div className="pt-3 text-center border-t border-sage-200/60 mt-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs text-charcoal-500 hover:text-brand-800 transition-colors font-medium"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Return to Login</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F7F8F5] flex items-center justify-center text-xs text-charcoal-500">
          <Loader2 className="h-5 w-5 animate-spin text-brand-700 mr-2" />
          <span>Loading invitation...</span>
        </div>
      }
    >
      <AcceptInviteForm />
    </Suspense>
  );
}
