'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface SplashScreenProps {
  /** Optional minimum display duration in milliseconds (default: 1300ms) */
  minDuration?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ minDuration = 1300 }) => {
  const [visible, setVisible] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    // Register Service Worker for PWA
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('[PWA] ServiceWorker registered with scope:', reg.scope);
          })
          .catch((err) => {
            console.warn('[PWA] ServiceWorker registration failed:', err);
          });
      });
    }

    // Check if splash was already shown in this tab session
    const hasSeenSplash = sessionStorage.getItem('flumenx_splash_shown');
    if (hasSeenSplash) {
      setVisible(false);
      return;
    }

    const timer = setTimeout(() => {
      setFadingOut(true);
      setTimeout(() => {
        setVisible(false);
        sessionStorage.setItem('flumenx_splash_shown', 'true');
      }, 500); // 500ms exit transition
    }, minDuration);

    return () => clearTimeout(timer);
  }, [minDuration]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#0d2a17] text-white transition-all duration-500 ease-out select-none ${
        fadingOut ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Dynamic Ambient Background Glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-lime-400/15 rounded-full blur-3xl animate-pulse pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-pulse pointer-events-none delay-700" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-forest-600/25 rounded-full blur-2xl pointer-events-none" />

      {/* Main Flash Screen Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-sm w-full">
        {/* Animated App Icon Squircle */}
        <div className="relative mb-6">
          {/* Glowing Aura Ring */}
          <div className="absolute -inset-2 rounded-3xl bg-gradient-to-tr from-lime-400/40 via-emerald-500/30 to-forest-600/40 blur-md animate-spin-slow opacity-80" />

          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-white shadow-2xl p-2 flex items-center justify-center overflow-hidden border border-white/40 transform transition-transform animate-bounce-subtle">
            <Image
              src="/images/logo-icon.png"
              alt="flumenxConectOS Icon"
              width={112}
              height={112}
              priority
              className="w-full h-full object-contain rounded-2xl"
            />
          </div>
        </div>

        {/* Brand Horizontal Logo with Shimmer */}
        <div className="mb-4 relative px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-lg">
          <Image
            src="/images/logo.png"
            alt="flumenxConectOS"
            width={240}
            height={44}
            priority
            className="h-9 sm:h-10 w-auto object-contain filter drop-shadow-md"
          />
        </div>

        {/* Tagline */}
        <p className="text-xs sm:text-sm font-medium text-emerald-200/90 tracking-wider uppercase mb-6 text-center">
          Marketing Operations Platform
        </p>

        {/* Animated Progress Loader Bar */}
        <div className="w-48 h-1.5 bg-forest-900/80 rounded-full overflow-hidden border border-emerald-500/30 shadow-inner">
          <div className="h-full bg-gradient-to-r from-lime-400 via-emerald-400 to-lime-300 rounded-full animate-progress-indeterminate" />
        </div>

        <span className="text-[10px] text-emerald-300/60 font-mono mt-3 tracking-widest uppercase">
          Initializing OS...
        </span>
      </div>
    </div>
  );
};

export default SplashScreen;
