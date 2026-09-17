'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { getErrorMessage } from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 select-none">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-8 pb-6 text-center border-b border-slate-100">
          <div className="h-12 w-12 rounded bg-brand-800 text-white font-bold text-lg flex items-center justify-center mx-auto mb-3 shadow-sm">
            FX
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">flumenxConectOS</h1>
          <p className="text-xs text-slate-500 mt-1">
            Marketing Operations & Client Management Platform
          </p>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2.5 text-xs text-red-800">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Email Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail className="h-4 w-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-brand-600 text-slate-900 placeholder-slate-400 transition-colors"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">Password</label>
              <Link
                href="/forgot-password"
                className="text-xs text-brand-800 hover:text-brand-900 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-10 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-brand-600 text-slate-900 placeholder-slate-400 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            isLoading={isSubmitting}
            className="w-full h-10 text-xs font-semibold tracking-wide"
          >
            Sign In to Workspace
          </Button>

          {/* Development Environment Email Helpers - Never rendered in production */}
          {process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ENABLE_DEV_HELPERS === 'true' && (
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-center">
                Development Quick Email Helpers
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setEmail('admin@flumenx.com'); setError(null); }}
                  className="p-2 border border-slate-200 rounded text-[11px] text-slate-700 hover:bg-slate-50 hover:border-brand-600 transition-colors text-left"
                >
                  <div className="font-semibold text-brand-800">Super Admin</div>
                  <div className="text-slate-400 text-[10px] truncate">admin@flumenx.com</div>
                </button>

                <button
                  type="button"
                  onClick={() => { setEmail('manager@acmedigital.com'); setError(null); }}
                  className="p-2 border border-slate-200 rounded text-[11px] text-slate-700 hover:bg-slate-50 hover:border-brand-600 transition-colors text-left"
                >
                  <div className="font-semibold text-slate-900">Client Admin</div>
                  <div className="text-slate-400 text-[10px] truncate">manager@acmedigital.com</div>
                </button>
              </div>
            </div>
          )}
        </form>
      </div>

      <p className="text-[11px] text-slate-400 mt-6 text-center">
        FlumenX Digital Marketing Operations &bull; Strictly Authorized Personnel Only
      </p>
    </div>
  );
}
