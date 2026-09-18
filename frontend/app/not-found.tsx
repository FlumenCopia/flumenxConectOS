import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Compass, ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F7F8F5] flex flex-col justify-center items-center p-6 select-none">
      <div className="max-w-md w-full bg-white border border-sage-200/90 rounded-2xl shadow-soft-md p-8 sm:p-10 text-center">
        <div className="flex justify-center mb-5">
          <Image
            src="/images/logo.png"
            alt="flumenxConectOS"
            width={220}
            height={55}
            priority
            className="h-11 w-auto object-contain"
          />
        </div>

        <div className="w-16 h-16 rounded-2xl bg-sage-100 text-sage-600 flex items-center justify-center mx-auto mb-4 border border-sage-200">
          <Compass className="w-8 h-8 text-brand-800 animate-pulse" />
        </div>

        <h1 className="text-2xl font-extrabold text-charcoal-900 tracking-tight">404 - Page Not Found</h1>
        <p className="text-xs text-charcoal-500 mt-2 mb-6 leading-relaxed">
          The page or resource you are looking for might have been moved, expired, or does not exist.
        </p>

        <div className="space-y-3">
          <Link href="/login" className="block">
            <Button size="lg" className="w-full bg-brand-800 hover:bg-brand-900 text-white font-semibold rounded-xl h-11 gap-2 shadow-soft-xs">
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Sign In</span>
            </Button>
          </Link>

          <Link href="/" className="block">
            <Button variant="outline" size="lg" className="w-full border-sage-300 text-charcoal-700 hover:bg-sage-50 font-semibold rounded-xl h-11 gap-2">
              <Home className="w-4 h-4 text-charcoal-500" />
              <span>Go to Overview</span>
            </Button>
          </Link>
        </div>
      </div>

      <p className="text-[11px] text-charcoal-400 mt-6">
        flumenxConectOS &bull; Digital Marketing Operations Platform
      </p>
    </div>
  );
}
