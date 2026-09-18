import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import QueryProvider from '@/components/providers/QueryProvider';
import { SplashScreen } from '@/components/ui/SplashScreen';
import { PWAInstallPrompt } from '@/components/ui/PWAInstallPrompt';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#166534',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export const metadata: Metadata = {
  title: 'flumenxConectOS - Internal Digital Marketing Operations Platform',
  description: 'Enterprise operations, lead CRM, unified multi-channel messaging, PWA, and reporting for FlumenX',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.png', sizes: 'any' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'flumenxConectOS',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="flumenxConectOS" />
      </head>
      <body className="min-h-screen bg-surface text-charcoal-900 antialiased font-sans">
        <SplashScreen />
        <QueryProvider>
          {children}
          <PWAInstallPrompt />
        </QueryProvider>
      </body>
    </html>
  );
}
