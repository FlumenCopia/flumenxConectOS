'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode
    if (typeof window !== 'undefined') {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      if (isStandalone) {
        setIsInstalled(true);
        return;
      }
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Only show if user hasn't dismissed it in this session
      const dismissed = sessionStorage.getItem('pwa_prompt_dismissed');
      if (!dismissed) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  if (!showPrompt || isInstalled || !deferredPrompt) return null;

  return (
    <aside
      aria-label="Install Application"
      className="fixed bottom-4 sm:bottom-6 right-3 sm:right-6 left-3 sm:left-auto sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto"
    >
      <div className="p-3.5 sm:p-4 bg-white/95 backdrop-blur-md border border-sage-200/90 rounded-2xl shadow-soft-xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Image
            src="/icons/icon-192x192.png"
            alt="flumenxConectOS"
            width={40}
            height={40}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-contain shadow-soft-xs border border-sage-100 shrink-0"
          />
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-charcoal-900 leading-tight truncate">Install flumenxConectOS</h4>
            <p className="text-[10px] text-sage-500 mt-0.5 truncate">Add to home screen or desktop for fast access</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleInstallClick}
            className="px-3 py-1.5 rounded-xl bg-brand-800 hover:bg-brand-900 text-white font-semibold text-xs flex items-center gap-1 shadow-forest-sm transition active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install</span>
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg text-sage-400 hover:text-charcoal-800 hover:bg-sage-100 transition"
            title="Dismiss"
            aria-label="Dismiss banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default PWAInstallPrompt;
