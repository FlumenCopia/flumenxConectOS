'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { getErrorMessage } from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Please enter both your email and password');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8F5] flex items-center justify-center p-0 lg:p-6 select-none">
      <div className="w-full max-w-6xl min-h-[660px] bg-white lg:border border-sage-200/90 lg:rounded-2xl lg:shadow-soft-lg flex flex-col lg:flex-row overflow-hidden">
        
        {/* Left Brand Showcase Banner (Desktop Only - matches reference design) */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#14532D] via-[#166534] to-[#0E3A20] text-white p-10 xl:p-12 flex-col justify-between relative overflow-hidden">
          {/* Subtle Abstract Wave Motif Graphic */}
          <div className="absolute inset-0 pointer-events-none opacity-20">
            <svg className="w-full h-full" viewBox="0 0 500 600" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M-50,300 C150,150 250,550 550,200 L550,650 L-50,650 Z"
                fill="url(#grad1)"
              />
              <path
                d="M-50,450 C200,300 300,580 550,350 L550,650 L-50,650 Z"
                fill="url(#grad2)"
                opacity="0.6"
              />
              <defs>
                <linearGradient id="grad1" x1="0" y1="0" x2="500" y2="600" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#4ADE80" />
                  <stop offset="1" stopColor="#052E16" />
                </linearGradient>
                <linearGradient id="grad2" x1="0" y1="0" x2="500" y2="600" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#2DD4BF" />
                  <stop offset="1" stopColor="#14532D" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Top Brand Header */}
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl overflow-hidden bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center shadow-sm">
                <Image
                  src="/icons/icon-192x192.png"
                  alt="flumenxConectOS"
                  width={44}
                  height={44}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h2 className="font-bold text-lg tracking-tight text-white leading-none">flumenxConectOS</h2>
                <p className="text-[10px] text-emerald-200 tracking-widest font-semibold uppercase mt-1">
                  Marketing Operations Platform
                </p>
              </div>
            </div>

            {/* Main Punchy Value Proposition */}
            <div className="mt-12 space-y-4 max-w-md">
              <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-white leading-tight">
                Turn <br />
                Conversations <br />
                into <span className="text-emerald-300">Growth.</span>
              </h1>
              <p className="text-xs xl:text-sm text-emerald-100 font-normal leading-relaxed">
                All your marketing operations, leads, clients and omnichannel conversations — unified in one place.
              </p>
            </div>

            {/* Feature Checkpoints */}
            <div className="mt-8 space-y-3">
              {[
                'Capture more leads across ad channels',
                'Unify all communication channels (WhatsApp, SMS, Web)',
                'Automate your follow-up workflows & tasks',
                'Deliver measurable ROI and attribution results',
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-2.5 text-xs text-emerald-50">
                  <div className="h-5 w-5 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-3 w-3 text-emerald-300" />
                  </div>
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Social Proof & Stats (matches reference design) */}
          <div className="relative z-10 pt-8 border-t border-white/10">
            <div className="grid grid-cols-3 gap-4 text-left">
              <div>
                <p className="text-xl font-bold text-white tracking-tight">500+</p>
                <p className="text-[11px] text-emerald-200">Agencies trust us</p>
              </div>
              <div>
                <p className="text-xl font-bold text-white tracking-tight">10x</p>
                <p className="text-[11px] text-emerald-200">Faster follow-ups</p>
              </div>
              <div>
                <p className="text-xl font-bold text-white tracking-tight">Real</p>
                <p className="text-[11px] text-emerald-200">Business growth</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Authentication Form Container */}
        <div className="w-full lg:w-1/2 p-6 sm:p-10 xl:p-14 flex flex-col justify-center bg-white">
          <div className="max-w-md w-full mx-auto">
            {/* Mobile-only logo */}
            <div className="lg:hidden text-center mb-6">
              <div className="flex justify-center mb-2">
                <Image
                  src="/images/logo.png"
                  alt="flumenxConectOS"
                  width={220}
                  height={55}
                  priority
                  className="h-10 w-auto object-contain"
                />
              </div>
              <p className="text-[10px] text-sage-500 tracking-wider uppercase font-semibold">
                Marketing Operations Platform
              </p>
            </div>

            {/* Auth Title */}
            <div className="text-center lg:text-left mb-6">
              <h2 className="text-2xl font-bold text-sage-900 tracking-tight">Welcome Back</h2>
              <p className="text-xs text-sage-500 mt-1">
                Sign in to your flumenxConectOS workspace account
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Email Address */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-sage-800">Email address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-sage-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full pl-9 pr-3 py-2.5 text-xs border border-sage-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 text-sage-900 placeholder-sage-400 transition-colors shadow-soft-xs"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-sage-800">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-sage-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-10 py-2.5 text-xs border border-sage-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 text-sage-900 placeholder-sage-400 transition-colors shadow-soft-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-sage-400 hover:text-sage-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between text-xs pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer text-sage-700 font-medium">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-sage-300 text-brand-700 focus:ring-brand-700/20 cursor-pointer"
                  />
                  <span>Remember me</span>
                </label>
                <Link
                  href="/forgot-password"
                  className="text-brand-800 hover:text-brand-900 font-semibold hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                isLoading={isSubmitting}
                variant="primary"
                className="w-full h-10 text-xs font-bold tracking-wide shadow-forest-sm mt-2"
              >
                <span>Sign In to Workspace</span>
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>

              {/* Or continue with divider */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-sage-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-white text-sage-400 text-[11px]">or continue with</span>
                </div>
              </div>

              {/* Social Login Buttons (Google / Microsoft - matches reference design) */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setError('SSO login is managed through your organization identity provider.')}
                  className="flex items-center justify-center gap-2 py-2 px-3 border border-sage-200 rounded-lg hover:bg-sage-50 text-xs font-semibold text-sage-700 shadow-soft-xs transition-colors"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Google</span>
                </button>

                <button
                  type="button"
                  onClick={() => setError('SSO login is managed through your organization identity provider.')}
                  className="flex items-center justify-center gap-2 py-2 px-3 border border-sage-200 rounded-lg hover:bg-sage-50 text-xs font-semibold text-sage-700 shadow-soft-xs transition-colors"
                >
                  <svg className="h-4 w-4" viewBox="0 0 23 23">
                    <path fill="#f35325" d="M1 1h10v10H1z" />
                    <path fill="#81bc06" d="M12 1h10v10H12z" />
                    <path fill="#05a6f0" d="M1 12h10v10H1z" />
                    <path fill="#ffba08" d="M12 12h10v10H12z" />
                  </svg>
                  <span>Microsoft</span>
                </button>
              </div>

              {/* Encryption Trust Badge */}
              <div className="pt-2 flex items-center justify-center gap-1.5 text-[11px] text-sage-500">
                <ShieldCheck className="h-3.5 w-3.5 text-brand-700" />
                <span>Your data is secure and encrypted</span>
              </div>

              {/* Development Environment Email Helpers */}
              {process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ENABLE_DEV_HELPERS === 'true' && (
                <div className="pt-3 border-t border-sage-100 space-y-1.5">
                  <p className="text-[10px] font-bold text-sage-400 uppercase tracking-wider text-center">
                    Dev Quick Helpers
                  </p>
                  <button
                    type="button"
                    onClick={() => { setEmail('admin@flumenx.com'); setError(null); }}
                    className="w-full p-2 border border-sage-200 rounded-lg text-left hover:bg-sage-50 transition-colors"
                  >
                    <div className="text-xs font-bold text-brand-800">Super Admin</div>
                    <div className="text-[10px] text-sage-500">admin@flumenx.com</div>
                  </button>
                </div>
              )}

              {/* Footer Terms */}
              <p className="text-[10px] text-sage-400 text-center pt-2">
                By signing in, you agree to our Terms of Service and Privacy Policy.
              </p>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
